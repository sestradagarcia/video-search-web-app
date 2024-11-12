from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from video_scene_search import get_scene_data, get_user_embedding
import logging
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Adjust this if you want a more restricted CORS policy

# VIDEO_DIRECTORY = 'video-search-react/src/assets'
VIDEO_DIRECTORY = os.path.abspath('video-search-react/src/assets')

# Serve video files from the video directory
@app.route('/videos/<path:filename>')
def serve_video(filename):
    return send_from_directory(VIDEO_DIRECTORY, filename)

# Check video file existence
def check_video_file_path(file_path):
    absolute_path = os.path.abspath(file_path)
    if not os.path.exists(absolute_path):
        raise FileNotFoundError(f"Video file path does not exist: {absolute_path}")
    return absolute_path

# Initial loading of JSON data
def load_scene_data(filepath):
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    global sceneChunk_embedding, sceneChunk_start, sceneChunk_end, sceneChunk_description
    sceneChunk_embedding = [scene['vector'] for scene in data]
    sceneChunk_start = [scene['start_ntp_float'] for scene in data]
    sceneChunk_end = [scene['end_ntp_float'] for scene in data]
    sceneChunk_description = [scene['text'] for scene in data]

# Initialize variables globally
sceneChunk_start = []
sceneChunk_end = []
sceneChunk_embedding = []
sceneChunk_description = []

@app.route('/upload-json', methods=['POST'])
def upload_json():
    global sceneChunk_embedding, sceneChunk_start, sceneChunk_end, sceneChunk_description

    try:
        if 'jsonFile' not in request.files:
            return jsonify({"error": "No JSON file part"}), 400

        json_file = request.files['jsonFile']
        new_data = json.load(json_file)

        # Extract video filename from JSON and verify existence
        video_file_name = new_data[0].get("file") if new_data and "file" in new_data[0] else None
        video_file_path = os.path.join(VIDEO_DIRECTORY, os.path.basename(video_file_name))

        # Update scene data
        sceneChunk_embedding = [scene['vector'] for scene in new_data]
        sceneChunk_start = [scene['start_ntp_float'] for scene in new_data]
        sceneChunk_end = [scene['end_ntp_float'] for scene in new_data]
        sceneChunk_description = [scene['text'] for scene in new_data]

        # Send back data with video file path relative to `/videos/` endpoint
        return jsonify({
            "message": "JSON file processed successfully and scene data updated",
            "video_file": f'/videos/{os.path.basename(video_file_name)}',
            "scenes": [{"text": scene["text"]} for scene in new_data]
        }), 200
    except Exception as e:
        logging.error("Error:", e)
        return jsonify({"error": str(e)}), 500


@app.route('/search', methods=['POST'])
def search():
    try:
        user_query = request.json.get('query')
        user_embedding = get_user_embedding(user_query)
        
        results = get_scene_data(
            user_embedding, sceneChunk_start, sceneChunk_end,
            sceneChunk_embedding, sceneChunk_description
        )
        
        return jsonify(results)
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
