import React, { useRef, useState } from 'react';
import sampleVideo from './assets/MovieMix.mp4';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const [userQuery, setUserQuery] = useState('');
  const [results, setResults] = useState([]);

  const generateThumbnail = (timestamp) => {
    return new Promise((resolve) => {
      // Create a new video element to avoid moving the main video timestamp
      const thumbnailVideo = document.createElement('video');
      thumbnailVideo.src = sampleVideo;
      thumbnailVideo.currentTime = timestamp;
  
      thumbnailVideo.onloadeddata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = thumbnailVideo.videoWidth;
        canvas.height = thumbnailVideo.videoHeight;
        const context = canvas.getContext('2d');
  
        thumbnailVideo.onseeked = () => {
          context.drawImage(thumbnailVideo, 0, 0, canvas.width, canvas.height);
          const thumbnailURL = canvas.toDataURL('image/png');
  
          setResults((prevResults) =>
            prevResults.map((scene) =>
              scene.timestamp === timestamp ? { ...scene, thumbnail: thumbnailURL } : scene
            )
          );
  
          // Cleanup and resolve the promise
          thumbnailVideo.remove();
          resolve();
        };
  
        thumbnailVideo.currentTime = timestamp;
      };
    });
  };

  const handleThumbnailClick = (timestamp) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play();
    }
  };

  const handleSearch = async () => {
    const response = await fetch('http://localhost:5000/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: userQuery }),
    });

    if (response.ok) {
      const data = await response.json();
      // setResults(data);

      // // Sequentially generate thumbnails for each scene
      // for (const scene of data) {
      //   await generateThumbnail(scene.timestamp);
      // }
              // Duplicate each scene result for testing
              const multipliedResults = data.flatMap(scene => Array(4).fill({ ...scene })); // Change 3 to however many copies you want

              setResults(multipliedResults);
      
              // Sequentially generate thumbnails for each scene
              for (const scene of multipliedResults) {
                  await generateThumbnail(scene.timestamp);
              }
      setUserQuery(''); // Reset search input
    }
  };

  return (
    <div className="app">
      <div className='search-bar'>
        <input
          type="text"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Enter your query"
        />
        <button onClick={handleSearch}>Search Scenes</button>
      </div>
    <div className='video-section'>
      <div className="video-container">
        <video ref={videoRef} controls width="100%">
          <source src={sampleVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="thumbnails">
        {results.map((scene, index) => (
          <div key={index} className="thumbnail" onClick={() => handleThumbnailClick(scene.timestamp)}>
            <h3 className='thumbnail-label'>{scene.label}</h3>
            <div className='thumbnail-preview'>
              <img src={scene.thumbnail} alt={`Thumbnail for ${scene.label}`} />
              <div className='video-text'>
                <p>Timestamp: {scene.timestamp}s</p>
                <p>Similarity: {scene.similarity.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

export default App;