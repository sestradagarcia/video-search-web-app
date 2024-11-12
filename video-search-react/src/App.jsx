import React, { useRef, useState, useEffect } from 'react';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const [userQuery, setUserQuery] = useState('');
  const [results, setResults] = useState([]);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const [jsonFile, setJsonFile] = useState(null);
  const [videoSrc, setVideoSrc] = useState('');
  const [overlayText, setOverlayText] = useState('');
  const [chunkDescriptions, setChunkDescriptions] = useState([]);
  const [showSceneDescription, setShowSceneDescription] = useState(false);

  // Handle JSON file upload
  const handleJsonUpload = (e) => {
    setJsonFile(e.target.files[0]);
  };

  const uploadJsonFile = async () => {
    if (jsonFile) {
      const formData = new FormData();
      formData.append('jsonFile', jsonFile);

      try {
        const response = await fetch('http://localhost:5000/upload-json', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();

        if (response.ok) {
          const videoPath = `http://localhost:5000${data.video_file}`;
          setVideoSrc(videoPath);
          setChunkDescriptions(data.scenes.map(scene => scene.text || ''));
          console.log("Uploaded videoPath data:", videoPath);

          if (videoRef.current) {
            videoRef.current.load();
            videoRef.current.play();
          }
        } else {
          throw new Error(data.error || 'Failed to upload JSON file');
        }
      } catch (error) {
        console.error("Error uploading JSON file:", error);
      }
    }
  };

// Generate thumbnails if the data structure is complete
const generateThumbnailsBatch = async (scenes, batchSize = 3) => {
  for (let i = 0; i < scenes.length; i += batchSize) {
    const batch = scenes.slice(i, i + batchSize);
    await Promise.all(
      batch
        .filter((scene) => scene.timestamp && typeof scene.similarity === 'number') // Filter complete scenes
        .map((scene) => generateThumbnail(scene.timestamp))
    );
  }
};


  const generateThumbnail = (timestamp) => {
    return new Promise((resolve) => {
      const thumbnailVideo = document.createElement('video');
      thumbnailVideo.src = videoSrc;
      thumbnailVideo.crossOrigin = "anonymous";
  
      thumbnailVideo.onloadedmetadata = () => {
        if (isFinite(timestamp)) {
          thumbnailVideo.currentTime = timestamp;
        } else {
          console.error("Invalid timestamp for setting currentTime:", timestamp);
          resolve(); // Resolve even if there's an error to prevent hanging promises
        }
      };
  
      thumbnailVideo.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 150;
        const context = canvas.getContext('2d');
  
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
  
      thumbnailVideo.onerror = (error) => {
        console.error("Error generating thumbnail for timestamp", timestamp, error);
        resolve();
      };
    });
  };
  
  // Inside the JSX where similarity is displayed
  // <p>Similarity: {typeof scene.similarity === 'number' ? scene.similarity.toFixed(2) : 'N/A'}</p>
  

  const handleThumbnailClick = (timestamp) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, timestamp - 1);
      videoRef.current.play();
    }
  };

  const handleSearch = async (query) => {
    try {
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
      setResults(data);

      await generateThumbnailsBatch(data, 3); // Generate thumbnails in batches of 3

      setOverlayText(`Showing results for "${query}"`);
      setTimeout(() => setOverlayText(''), 3000);
      setUserQuery('');
    } catch (error) {
      console.error("Error in handleSearch:", error);
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
        setUserQuery(transcript);
        handleSearch(transcript);
      };

      recognition.onerror = (event) => {
        console.error("Recognition error:", event.error);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
    }

    setListening(true);
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  // Update overlay text based on video time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateOverlay = () => {
      const currentSecond = Math.floor(video.currentTime);
      
      // Show each description for every 1-second interval
      if (showSceneDescription) {
        setOverlayText(chunkDescriptions[currentSecond] || '');
      }
    };

    video.addEventListener('timeupdate', updateOverlay);

    return () => {
      video.removeEventListener('timeupdate', updateOverlay);
    };
  }, [chunkDescriptions, showSceneDescription]);

  return (
    <div className="app">
      <div className="search-bar">
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

      <div className="upload-section">
        <input type="file" accept=".json" onChange={handleJsonUpload} />
        <button onClick={uploadJsonFile}>Upload JSON</button>
        <button onClick={() => setShowSceneDescription((prev) => !prev)}>
          {showSceneDescription ? 'Hide Scene Description' : 'Show Scene Description'}
        </button>
      </div>

      <div className="video-section">
        <div className="video-container">
          <video ref={videoRef} controls width="100%">
            <source src={videoSrc} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          {overlayText && <div className="overlay-text">{overlayText}</div>}
        </div>
        
        <div className="thumbnails">
  {results
    .filter((scene) => scene.thumbnail && scene.timestamp) // Display only scenes with valid thumbnails
    .map((scene, index) => (
      <div key={index} className="thumbnail" onClick={() => handleThumbnailClick(scene.timestamp)}>
        <h3 className="thumbnail-label">{scene.description || 'Scene'}</h3>
        <img src={scene.thumbnail} alt={`Thumbnail for ${scene.description || 'Scene'}`} />
        <p>Timestamp: {scene.timestamp}s</p>
        <p>Similarity: {typeof scene.similarity === 'number' ? scene.similarity.toFixed(2) : 'N/A'}</p>
      </div>
    ))}
</div>

      </div>
    </div>
  );
}

export default App;
