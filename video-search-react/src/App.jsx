import React, { useRef, useState, useEffect } from 'react';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const [userQuery, setUserQuery] = useState('');
  const [results, setResults] = useState([]);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const [jsonFile, setJsonFile] = useState(null);
  const [jsonFiles, setJsonFiles] = useState([]); // List of available JSON files
  const [selectedJsonFile, setSelectedJsonFile] = useState('');
  const [videoSrc, setVideoSrc] = useState('');
  const [overlayText, setOverlayText] = useState('');
  const [chunkDescriptions, setChunkDescriptions] = useState([]);
  const [showSceneDescription, setShowSceneDescription] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.45);

  useEffect(() => {
    // Fetch the list of JSON files on component mount
    fetch('http://localhost:5000/list-json-files')
      .then(response => response.json())
      .then(data => setJsonFiles(data.json_files || []))
      .catch(error => console.error("Error fetching JSON file list:", error));
  }, []);

  // Handle JSON file upload from manual selection
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

  // Upload selected JSON file from dropdown list
  const uploadSelectedJsonFile = async () => {
    if (selectedJsonFile) {
      try {
        const response = await fetch(`http://localhost:5000/upload-json?file=${selectedJsonFile}`, {
          method: 'POST',
        });
        const data = await response.json();
        console.log("Uploaded selected JSON file data:", data);
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

  const handleJsonFileChange = (e) => {
    setSelectedJsonFile(e.target.value);
  };

  const handleSearch = async (query) => {
    try {
      const response = await fetch('http://localhost:5000/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query, similarity_threshold: similarityThreshold }),
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateOverlay = () => {
      const currentSecond = Math.floor(video.currentTime);

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

      <div className="settings">
        <label>
          Similarity Threshold: {similarityThreshold}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={similarityThreshold}
            onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
          />
        </label>
      </div>

      <div className="upload-section">
        <input type="file" accept=".json" onChange={handleJsonUpload} />
        <button onClick={uploadJsonFile}>Upload JSON</button>

        <select onChange={handleJsonFileChange} value={selectedJsonFile}>
          <option value="">Select a JSON file</option>
          {jsonFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
        <button onClick={uploadSelectedJsonFile} disabled={!selectedJsonFile}>
          Load Selected JSON
        </button>

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
                <img src={scene.thumbnail} alt={`Thumbnail for ${scene.description || 'Scene'}`} />
                <p>Timestamp: {scene.timestamp}s</p>
                <p>Similarity: {scene.similarity.toFixed(2)}%</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default App;
