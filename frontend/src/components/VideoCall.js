import React, { useRef, useEffect, useState } from 'react';
import Peer from 'simple-peer';
import { useSocket } from '../contexts/SocketContext';
import './VideoCall.css';

const VideoCall = ({ isOpen, onClose, callType, remoteUserId, isInitiator }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [isInitializing, setIsInitializing] = useState(false);
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerRef = useRef();
  const { socket } = useSocket();

  useEffect(() => {
    if (!isOpen || !socket) {
      console.log('VideoCall not opening:', { isOpen, hasSocket: !!socket });
      return;
    }

    // Prevent duplicate initialization
    if (isInitializing || peerRef.current || localStream) {
      console.log('Call already initializing or initialized, skipping...');
      return;
    }

    console.log('=== INITIALIZING CALL ===');
    console.log('Call Type:', callType);
    console.log('Remote User ID:', remoteUserId);
    console.log('Is Initiator:', isInitiator);

    setIsInitializing(true);

    const initCall = async () => {
      try {
        // Get user media based on call type
        const constraints = {
          audio: true,
          video: callType === 'video' ? { width: 1280, height: 720 } : false
        };

        console.log('Requesting media with constraints:', constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✓ Media stream obtained');
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection
        const peer = new Peer({
          initiator: isInitiator,
          trickle: false,
          stream: stream,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        peerRef.current = peer;

        peer.on('signal', (data) => {
          console.log('Peer signal generated:', data.type);
          if (data.type === 'offer') {
            console.log('Sending offer to:', remoteUserId);
            socket.emit('webrtc_offer', {
              target: remoteUserId,
              offer: data
            });
          } else if (data.type === 'answer') {
            console.log('Sending answer to:', remoteUserId);
            socket.emit('webrtc_answer', {
              target: remoteUserId,
              answer: data
            });
          }
        });

        peer.on('stream', (stream) => {
          console.log('✓ Remote stream received');
          setRemoteStream(stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
          setCallStatus('Connected');
        });

        peer.on('connect', () => {
          console.log('✓ Peer connection established');
          setCallStatus('Connected');
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          console.error('Error name:', err.name);
          console.error('Error message:', err.message);
          
          // Don't end call immediately on error, some errors are recoverable
          if (err.message && err.message.includes('connection failed')) {
            setCallStatus('Reconnecting...');
          } else {
            setCallStatus(`Error: ${err.message || 'Connection issue'}`);
          }
          
          // Only end call on critical errors
          if (err.name === 'MediaStreamError' || err.message?.includes('getUserMedia')) {
            console.log('Critical error, ending call');
            setTimeout(() => handleEndCall(), 2000);
          }
        });

        peer.on('close', () => {
          console.log('Peer connection closed');
          setCallStatus('Call ended');
          // Don't call handleEndCall here to avoid double cleanup
        });

        // Listen for WebRTC signaling
        socket.on('webrtc_offer', ({ offer, caller }) => {
          console.log('Received WebRTC offer from caller, isInitiator:', isInitiator);
          if (peerRef.current && !isInitiator) {
            console.log('Signaling offer to peer');
            peerRef.current.signal(offer);
          }
        });

        socket.on('webrtc_answer', ({ answer }) => {
          console.log('Received WebRTC answer, isInitiator:', isInitiator);
          if (peerRef.current && isInitiator) {
            console.log('Signaling answer to peer');
            peerRef.current.signal(answer);
          }
        });

        socket.on('ice_candidate', ({ candidate }) => {
          console.log('Received ICE candidate');
          if (peerRef.current) {
            peerRef.current.signal(candidate);
          }
        });

        socket.on('call_ended', () => {
          console.log('Remote user ended the call');
          setCallStatus('Call ended by remote user');
          setTimeout(() => handleEndCall(), 1000);
        });

      } catch (error) {
        console.error('Error accessing media devices:', error);
        setCallStatus('Failed to access camera/microphone');
        setIsInitializing(false);
      }
    };

    initCall();

    return () => {
      console.log('useEffect cleanup called, isOpen:', isOpen);
      
      // Only cleanup if component is actually unmounting, not just re-rendering
      if (!isOpen) {
        console.log('Skipping cleanup - call is closing via handleEndCall');
        return;
      }
      
      console.log('Cleaning up call resources...');
      
      if (localStream) {
        localStream.getTracks().forEach(track => {
          console.log('Cleanup: Stopping track:', track.kind);
          track.stop();
        });
      }
      
      if (peerRef.current) {
        console.log('Cleanup: Destroying peer');
        try {
          peerRef.current.destroy();
        } catch (err) {
          console.error('Error in cleanup:', err);
        }
      }
      
      socket?.off('webrtc_offer');
      socket?.off('webrtc_answer');
      socket?.off('ice_candidate');
      socket?.off('call_ended');
      setIsInitializing(false);
    };
  }, [isOpen, socket, callType, remoteUserId, isInitiator, localStream]); // Added localStream to dependencies

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const handleEndCall = () => {
    console.log('handleEndCall called');
    
    // Stop local media tracks
    if (localStream) {
      console.log('Stopping local stream tracks...');
      localStream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      setLocalStream(null);
    }
    
    // Destroy peer connection
    if (peerRef.current) {
      console.log('Destroying peer connection...');
      try {
        peerRef.current.destroy();
      } catch (err) {
        console.error('Error destroying peer:', err);
      }
      peerRef.current = null;
    }
    
    // Notify other user
    if (socket) {
      console.log('Emitting call_ended to remote user:', remoteUserId);
      socket.emit('call_ended', { target: remoteUserId });
    }
    
    setRemoteStream(null);
    setIsInitializing(false);
    
    // Close the call UI
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="video-call-overlay">
      <div className="video-call-container">
        <div className="video-call-header">
          <h3>{callType === 'video' ? '📹 Video Call' : '🎤 Audio Call'}</h3>
          <span className="call-status">{callStatus}</span>
          <button className="close-btn" onClick={handleEndCall}>✕</button>
        </div>

        <div className="video-streams">
          <div className="remote-video-container">
            {callType === 'video' ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />
            ) : (
              <div className="audio-call-avatar">
                <div className="avatar-circle">
                  <span className="avatar-icon">👤</span>
                </div>
                <p>Audio Call</p>
              </div>
            )}
            {!remoteStream && (
              <div className="waiting-overlay">
                <div className="spinner"></div>
                <p>Waiting for connection...</p>
              </div>
            )}
          </div>

          {callType === 'video' && (
            <div className="local-video-container">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video"
              />
              {isVideoOff && (
                <div className="video-off-overlay">
                  <span>📷 Camera Off</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="video-call-controls">
          <button
            className={`control-btn ${isMuted ? 'active' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          {callType === 'video' && (
            <button
              className={`control-btn ${isVideoOff ? 'active' : ''}`}
              onClick={toggleVideo}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? '📷❌' : '📹'}
            </button>
          )}

          <button
            className="control-btn end-call-btn"
            onClick={handleEndCall}
            title="End call"
          >
            📞 End Call
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
