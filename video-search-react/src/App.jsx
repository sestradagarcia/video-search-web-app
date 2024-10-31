import React, { useRef, useState } from 'react';
import sampleVideo from './assets/MovieMix.mp4';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const [userQuery, setUserQuery] = useState('');
  const [results, setResults] = useState([]);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const generateThumbnail = (timestamp) => {
    return new Promise((resolve) => {
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

  const handleSearch = async (query) => {
    try {
      console.log("Sending query to backend:", query); // Debugging log for query
      const response = await fetch('http://localhost:5000/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      console.log("Received response:", data); // Debugging log for response data
      setResults(data);
      for (const scene of data) {
        await generateThumbnail(scene.timestamp);
      }
      setUserQuery(''); // Clear search input after handling
    } catch (error) {
      console.error("Error in handleSearch:", error); // Error handling
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error("SpeechRecognition is not supported in this browser.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Transcription result:", transcript); // Debugging log for transcription
        setUserQuery(transcript);
        
        // Call handleSearch with the transcription result immediately
        handleSearch(transcript);
      };

      recognition.onerror = (event) => {
        console.error("Recognition error:", event.error); // Log recognition errors
      };

      recognition.onend = () => {
        console.log("Recognition ended.");
        setListening(false);
      };

      recognitionRef.current = recognition;
    }

    setListening(true);
    console.log("Starting recognition...");
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      console.log("Stopping recognition...");
      recognitionRef.current.stop();
      setListening(false);
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
        <button onClick={() => handleSearch(userQuery)}>Search Scenes</button>
        <button onClick={listening ? stopListening : startListening}>
          {listening ? 'Stop Mic' : '🎙️ Speak'}
        </button>
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
