import numpy as np
import openai
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# Load the sentence-transformers model for embedding generation
model_miniLM = SentenceTransformer('all-MiniLM-L6-v2')
# model_miniLM_12 = SentenceTransformer('all-MiniLM-L12-v2')
# model_mpnet = SentenceTransformer('paraphrase-mpnet-base-v2')

# Set up the Azure OpenAI API key and endpoint
openai.api_type = "azure"
openai.api_base = "https://<your-resource-name>.openai.azure.com/"
openai.api_version = "2022-12-01"
openai.api_key = "<your-api-key>"

# Function to get embeddings from OpenAI API
def get_azure_embedding(query):
    response = openai.Embedding.create(
        input=query,
        engine="text-embedding-ada-002"
    )
    return response['data'][0]['embedding']

# Encode the user's query into a vector
def get_user_embedding(query, model_name='all-MiniLM-L6-v2'):
    if model_name == 'all-MiniLM-L6-v2':
        user_embedding = model_miniLM.encode([query]).tolist()  # Convert to list
    elif model_name == 'all-MiniLM-L12-v2':
        user_embedding = model_miniLM_12.encode([query]).tolist()  # Convert to list
    elif model_name == 'text-embedding-ada-002':
        user_embedding = get_azure_embedding(query)
    elif model_name == 'model_mpnet':
        user_embedding = model_mpnet.encode([query]).tolist()
    else:
        raise ValueError(f"Unsupported model name: {model_name}")
    return user_embedding

import numpy as np
import logging

def vector_search(user_embedding, sceneChunk_start, sceneChunk_end, sceneChunk_embedding, sceneChunk_description, similarity_threshold=0.4):
    # Check if sceneChunk_embedding or user_embedding are empty
    if len(sceneChunk_embedding) == 0 or len(user_embedding) == 0:
        logging.error("Embedding arrays are empty. Ensure data is properly loaded.")
        return []  # Return an empty list to prevent further processing

    # Convert lists to numpy arrays for cosine similarity search
    sceneChunk_embeddings_np = np.array(sceneChunk_embedding)
    user_embedding_np = np.array(user_embedding).reshape(1, -1)  # Reshape to 2D array for cosine_similarity

    # Check if sceneChunk_embeddings_np is 2D
    if sceneChunk_embeddings_np.ndim != 2:
        logging.error("sceneChunk_embeddings_np is not a 2D array.")
        return []

    # Calculate cosine similarities
    similarities = cosine_similarity(user_embedding_np, sceneChunk_embeddings_np)[0]

    # Filter results based on similarity threshold
    filtered_results = [
        (sceneChunk_start[i], sceneChunk_end[i], sceneChunk_description[i], similarities[i]) 
        for i in range(len(similarities)) if similarities[i] >= similarity_threshold
    ]

    # Sort filtered results by start time
    filtered_results.sort(key=lambda x: x[0])
    logging.debug(f"Filtered results: {filtered_results}")

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
                merged_results.append(current_group)
                current_group = [(start, end, description, similarity)]

    if current_group:
        merged_results.append(current_group)

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
import logging

def get_scene_data(user_embedding, sceneChunk_start, sceneChunk_end, sceneChunk_embedding, sceneChunk_description):
    # Perform vector search and handle empty results
    results = vector_search(user_embedding, sceneChunk_start, sceneChunk_end, sceneChunk_embedding, sceneChunk_description)

    if not results:
        logging.warning("No results found after vector search.")
        return []

    # Process complete results only
    scenes_with_thumbnails = []
    for i, result in enumerate(results):
        if len(result) == 4:
            timestamp, similarity, description, end_time = result
            scenes_with_thumbnails.append({
                "timestamp": timestamp,
                "similarity": similarity,
                "description": description,
                "end_time": end_time
            })
        else:
            logging.error(f"Result at index {i} does not have enough elements: {result}")

    return scenes_with_thumbnails
