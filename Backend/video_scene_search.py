import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Load the sentence-transformers model for embedding generation
model = SentenceTransformer('all-MiniLM-L6-v2')

# Encode the user's query into a vector
def get_user_embedding(query):
    user_embedding = model.encode([query]).tolist()  # Convert to list
    return user_embedding

# Function to perform vector search between user_embedding & scene_embeddings and sort by embedding start time
def vector_search(user_embedding, sceneChunk_start, sceneChunk_end, sceneChunk_embedding, sceneChunk_description, similarity_threshold=0.4):
    # Convert lists to numpy arrays for consine similarity search 
    sceneChunk_embeddings_np = np.array(sceneChunk_embedding)
    user_embedding_np = np.array(user_embedding).reshape(1, -1)
    
    # Calculate cosine similarities between user embedding and scene embeddings
    similarities = cosine_similarity(user_embedding_np, sceneChunk_embeddings_np)[0]

    # Filter results based on similarity[i] being above similarity threshold
    filtered_results = [
        (sceneChunk_start[i], sceneChunk_end[i], sceneChunk_description[i], similarities[i]) 
        for i in range(len(similarities)) if similarities[i] >= similarity_threshold
    ]

    # Sort filtered results by start time
    filtered_results.sort(key=lambda x: x[0])  # Sort by start time

    # Return filtered results for further processing
    return filtered_results

# Function to merge scene chunks based on time proximity stated by time_gap_threshold argument
def merge_vector_scene_chunks(filtered_results, time_gap_threshold=60):
    merged_results = []
    current_group = []

    for start, end, description, similarity in filtered_results:
        if not current_group:
            current_group.append((start, end, description, similarity))
        else:
            last_start, last_end, last_description, last_similarity = current_group[-1]

            # Check if the current chunk starts after the last chunk ends
            if (start - last_end) <= time_gap_threshold:
                current_group.append((start, end, description, similarity))
            else:
                # Finalise the previous group
                earliest_timestamp = current_group[0][0]
                combined_description = ' '.join([desc for _, _, desc, _ in current_group])
                avg_similarity = np.mean([sim for _, _, _, sim in current_group])
                merged_results.append((earliest_timestamp, avg_similarity, combined_description))
                
                # Start a new group
                current_group = [(start, end, description, similarity)]

    # Handle the last group
    if current_group:
        earliest_timestamp = current_group[0][0]
        avg_similarity = np.mean([sim for _, _, _, sim in current_group])
        combined_description = ' '.join([desc for _, _, desc, _ in current_group])
        merged_results.append((earliest_timestamp, avg_similarity, combined_description))

    return merged_results

# Function to search and merge scenes
def search_and_merge(user_embedding, sceneChunk_start, sceneChunk_end, sceneChunk_embedding, sceneChunk_description, top_k=None, similarity_threshold=0.45, time_gap_threshold=10):
    # Perform vector search
    filtered_results = vector_search(user_embedding, sceneChunk_start, sceneChunk_end, sceneChunk_embedding, sceneChunk_description, similarity_threshold)

    # Merge vector scene chunks
    merged_results = merge_vector_scene_chunks(filtered_results, time_gap_threshold)

    # Return only the top_k results if specified
    return merged_results[:top_k] if top_k is not None else merged_results

# Function to generate scenes with timestamps and thumbnails
def get_scene_timestamps_with_thumbnails(user_embedding,  sceneChunk_start, sceneChunk_end, sceneChunk_embedding, sceneChunk_description, video_path):
    # First, get the merged scene results
    results = search_and_merge(
        user_embedding, 
        sceneChunk_start, 
        sceneChunk_end, 
        sceneChunk_embedding, 
        sceneChunk_description
    )

    # Extract only the timestamps and generate thumbnails
    scenes_with_thumbnails = []
    for i, result in enumerate(results):  # Use enumerate to get both index and result tuple
        timestamp = result[0]  # Get the timestamp from the merged result
        similarity = result[1]
        scene_data = {
            "label": f"Scene {i + 1}",
            "timestamp": timestamp,
            "similarity": similarity, 
        }
        scenes_with_thumbnails.append(scene_data)
    
    return scenes_with_thumbnails
