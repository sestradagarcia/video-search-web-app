from video_scene_search import get_user_embedding, get_scene_timestamps_with_thumbnails  # Import functions
import json
from video_scene_search import get_scene_timestamps_with_thumbnails, get_user_embedding 

# Path to the video file
video_path = "video-and-json/MovieMix.mp4"

# Load JSON data
with open('video-and-json/MovieMix_1_sec_chunk.json', 'r') as f:
    data = json.load(f)

sceneChunk_embedding = [scene['vector'] for scene in data]
sceneChunk_start = [scene['start_ntp_float'] for scene in data]
sceneChunk_end = [scene['end_ntp_float'] for scene in data]
sceneChunk_description = [scene['text'] for scene in data]


# Continuous loop to allow multiple queries
while True:
    # Ask the user to input a query
    user_query = input("Please enter your search query (or type 'exit' to quit): ")

    # Exit condition
    if user_query.lower() in ['exit', 'quit']:
        print("Exiting the program. Goodbye!")
        break

    # Get the user embedding based on the input query
    user_embedding = get_user_embedding(user_query)

    # Get scenes with timestamps and thumbnails
    scenes = get_scene_timestamps_with_thumbnails(
            user_embedding, sceneChunk_start, sceneChunk_end,
            sceneChunk_embedding, sceneChunk_description, video_path
        )
    
    # Print results for the user's query
    if scenes:
        for scene in scenes:
            print(f"- User query: {user_query}\n"
                  f"Scene starting timestamp at: {scene['timestamp']}\n"
                  #f"Thumbnail: {scene['thumbnail']}\n"
            )
    else:
        print(f"No matching scenes found for query: {user_query}\n")
