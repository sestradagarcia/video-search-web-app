from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from video_scene_search import get_scene_timestamps_with_thumbnails, get_user_embedding 

app = Flask(__name__)
CORS(app, resources={r"/search": {"origins": "http://localhost:5173"}}) #Enabled for react app route

# Path to the video file
video_path = "video-and-json/MovieMix.mp4"

# Load JSON data
with open('video-and-json/MovieMix_1_sec_chunk.json', 'r') as f:
    data = json.load(f)

sceneChunk_embedding = [scene['vector'] for scene in data]
sceneChunk_start = [scene['start_ntp_float'] for scene in data]
sceneChunk_end = [scene['end_ntp_float'] for scene in data]
sceneChunk_description = [scene['text'] for scene in data]

# API endpoint to handle search requests
@app.route('/search', methods=['POST'])
def search():
    try:
        user_query = request.json.get('query')
        print("User Query:", user_query)
        
        user_embedding = get_user_embedding(user_query)
        
        results_with_thumbnails = get_scene_timestamps_with_thumbnails(
            user_embedding, sceneChunk_start, sceneChunk_end,
            sceneChunk_embedding, sceneChunk_description, video_path
        )
        
        print("Results:", results_with_thumbnails)
        return jsonify(results_with_thumbnails)
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)

