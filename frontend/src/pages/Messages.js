import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';
import { uploadToSupabase, deleteFromSupabase } from '../services/supabase';
import { 
  PhotoIcon, MicrophoneIcon, PaperAirplaneIcon, 
  XMarkIcon, DocumentIcon, CheckIcon, ArrowDownTrayIcon,
  PhoneIcon, VideoCameraIcon
} from '@heroicons/react/24/outline';
import VideoCall from '../components/VideoCall';

const Messages = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [sharedMedia, setSharedMedia] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  
  // Call states
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callType, setCallType] = useState(null); // 'video' or 'audio'
  const [isCallInitiator, setIsCallInitiator] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [remoteCallUserId, setRemoteCallUserId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await api.get('/messages/conversations');
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async (userId) => {
    try {
      const response = await api.get(`/messages/${userId}`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, []);

  // Fetch shared media
  const fetchSharedMedia = useCallback(async (userId) => {
    try {
      const response = await api.get(`/messages/shared-media/${userId}`);
      setSharedMedia(response.data.media || []);
    } catch (error) {
      console.error('Failed to fetch shared media:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.user.id);
      fetchSharedMedia(selectedConversation.user.id);
    }
  }, [selectedConversation, fetchMessages, fetchSharedMedia]);

  // Socket.IO real-time messaging and call handling
  useEffect(() => {
    if (!socket || !user) return;

    const handleReceiveMessage = (data) => {
      console.log('Received message via socket:', data);
      
      // Only add message if it's from the current conversation or sent by current user
      if (selectedConversation) {
        const isSender = data.sender?.id === user.id;
        const isReceiver = data.sender?.id === selectedConversation.user.id;
        
        if (isSender || isReceiver) {
          setMessages(prev => {
            // Check if message already exists to prevent duplicates
            const exists = prev.some(msg => msg.id === data.id);
            if (exists) return prev;
            return [...prev, data];
          });
          scrollToBottom();
        }
      }
      
      // Always update conversations list to show new message notification
      fetchConversations();
    };

    socket.on('receive_message', handleReceiveMessage);
    
    // Handle incoming calls
    socket.on('incoming_call', (data) => {
      console.log('Incoming call from:', data);
      setIncomingCall(data);
    });

    socket.on('call_accepted', (data) => {
      console.log('Call accepted:', data);
      setIsCallOpen(true);
    });

    socket.on('call_declined', () => {
      console.log('Call declined');
      alert('Call was declined');
      setIsCallOpen(false);
      setCallType(null);
    });
    
    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('incoming_call');
      socket.off('call_accepted');
      socket.off('call_declined');
    };
  }, [socket, selectedConversation, user, fetchConversations]);

  // Auto scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Send text message
  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !audioBlob) || !selectedConversation) return;

    setIsSending(true);
    try {
      let messageData = {
        receiver_id: selectedConversation.user.id,
        content: newMessage.trim(),
        message_type: 'text'
      };

      // Handle audio message
      if (audioBlob) {
        console.log('Uploading audio to Supabase...', audioBlob.size);
        const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        const { url, path } = await uploadToSupabase(audioFile, 'messages/audio');
        console.log('Audio uploaded:', url);
        
        messageData = {
          ...messageData,
          message_type: 'audio',
          media_url: url,
          media_path: path,
          content: newMessage.trim() || 'Voice message'
        };
      }

      console.log('Sending message:', messageData);
      const response = await api.post('/messages', messageData);
      console.log('Message sent:', response.data);
      
      // Emit to socket for real-time delivery
      if (socket && socket.connected) {
        console.log('Emitting message via socket to recipient:', selectedConversation.user.id);
        socket.emit('send_message', {
          ...response.data.message_data,
          recipient_id: selectedConversation.user.id,
          sender: {
            id: user.id,
            username: user.username,
            profile_pic: user.profile_pic
          }
        });
      } else {
        console.warn('Socket not connected');
      }

      setMessages(prev => [...prev, response.data.message_data]);
      setNewMessage('');
      setAudioBlob(null);
      audioChunksRef.current = [];

      fetchConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert(`Failed to send message: ${error.response?.data?.error || error.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedConversation) {
      console.log('No file selected or no conversation');
      return;
    }

    console.log('File selected:', file.name, file.type, file.size);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      e.target.value = '';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      e.target.value = '';
      return;
    }

    setIsSending(true);
    try {
      console.log('Starting upload to Supabase...');
      // Upload to Supabase
      const uploadResult = await uploadToSupabase(file, 'messages/images');
      console.log('Upload successful:', uploadResult);

      const { url, path } = uploadResult;

      // Send message with image
      const messageData = {
        receiver_id: selectedConversation.user.id,
        content: newMessage.trim() || 'Sent an image',
        message_type: 'image',
        media_url: url,
        media_path: path
      };

      console.log('Sending message to backend:', messageData);
      const response = await api.post('/messages', messageData);
      console.log('Backend response:', response.data);

      // Emit to socket for real-time delivery
      if (socket && socket.connected) {
        console.log('Emitting image message to recipient:', selectedConversation.user.id);
        socket.emit('send_message', {
          ...response.data.message_data,
          recipient_id: selectedConversation.user.id,
          sender: {
            id: user.id,
            username: user.username,
            profile_pic: user.profile_pic
          }
        });
      } else {
        console.warn('Socket not connected');
      }

      setMessages(prev => [...prev, response.data.message_data]);
      setNewMessage('');

      fetchConversations();
      fetchSharedMedia(selectedConversation.user.id);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      console.log('Image sent successfully!');
    } catch (error) {
      console.error('Failed to upload image:', error);
      console.error('Error details:', error.response?.data || error.message);
      alert(`Failed to upload image: ${error.response?.data?.error || error.message || 'Unknown error'}`);
      
      // Clear file input on error
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsSending(false);
    }
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, creating blob...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('Audio blob created:', audioBlob.size, 'bytes');
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert(`Microphone access denied: ${error.message}`);
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Call handlers
  const initiateCall = (type) => {
    if (!selectedConversation) return;
    
    console.log('Initiating call:', {
      type,
      targetUserId: selectedConversation.user.id,
      caller: {
        id: user.id,
        username: user.username
      }
    });
    
    setCallType(type);
    setIsCallInitiator(true);
    setRemoteCallUserId(selectedConversation.user.id);
    setIsCallOpen(true);
    
    // Emit call initiation to the other user
    if (socket) {
      socket.emit('call_user', {
        targetUserId: selectedConversation.user.id,
        callType: type,
        caller: {
          id: user.id,
          username: user.username,
          profile_pic: user.profile_pic
        }
      });
      console.log('Call emit sent to backend');
    } else {
      console.error('Socket not available');
    }
  };

  const acceptCall = () => {
    if (!incomingCall) return;
    
    setCallType(incomingCall.callType);
    setIsCallInitiator(false);
    setRemoteCallUserId(incomingCall.caller.id);
    setIsCallOpen(true);
    
    // Find and select the conversation with the caller
    const callerConversation = conversations.find(
      conv => conv.user.id === incomingCall.caller.id
    );
    if (callerConversation) {
      setSelectedConversation(callerConversation);
    }
    
    // Notify caller that call is accepted
    if (socket) {
      socket.emit('call_accepted', {
        targetUserId: incomingCall.caller.id
      });
    }
    
    setIncomingCall(null);
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    
    if (socket) {
      socket.emit('call_declined', {
        targetUserId: incomingCall.caller.id
      });
    }
    
    setIncomingCall(null);
  };

  const handleCloseCall = () => {
    setIsCallOpen(false);
    setCallType(null);
    setIsCallInitiator(false);
    setRemoteCallUserId(null);
  };

  // Cancel audio recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      const stream = mediaRecorderRef.current.stream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioBlob(null);
      audioChunksRef.current = [];
    }
  };

  // Mark message as read
  const markAsRead = async (messageId) => {
    try {
      await api.put(`/messages/${messageId}/read`);
      // Update read status in UI
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, is_read: true } : m
      ));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh'
      }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 2rem)',
      padding: '1rem',
      maxWidth: '1400px',
      margin: '0 auto',
      width: '100%'
    }}>
      {/* Main Messages Container */}
      <div style={{
        flex: 1,
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        {/* Top Profile Icons Bar */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '2px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          overflowX: 'auto',
          minHeight: '110px',
          backgroundColor: 'var(--bg-card)',
          background: 'linear-gradient(to bottom, var(--bg-card) 0%, var(--bg-primary) 100%)'
        }}>
          {conversations.length === 0 ? (
            <div style={{
              width: '100%',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem'
            }}>
              No conversations yet
            </div>
          ) : (
            conversations.slice(0, 8).map((conv) => (
              <div
                key={conv.user.id}
                onClick={() => setSelectedConversation(conv)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  minWidth: '80px',
                  opacity: selectedConversation?.user.id === conv.user.id ? 1 : 0.7,
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  transform: selectedConversation?.user.id === conv.user.id ? 'scale(1.05)' : 'scale(1)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => {
                  if (selectedConversation?.user.id !== conv.user.id) {
                    e.currentTarget.style.opacity = '0.7';
                  }
                }}
              >
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1.5rem',
                    backgroundImage: conv.user.profile_pic && conv.user.profile_pic !== 'default.jpg'
                      ? `url(${conv.user.profile_pic})`
                      : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: selectedConversation?.user.id === conv.user.id 
                      ? 'none'
                      : '3px solid var(--bg-card)',
                    boxShadow: selectedConversation?.user.id === conv.user.id
                      ? '0 0 0 3px var(--primary-color), 0 4px 12px rgba(0, 0, 0, 0.15)'
                      : '0 2px 8px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s ease'
                  }}>
                    {(!conv.user.profile_pic || conv.user.profile_pic === 'default.jpg')
                      && conv.user.username?.charAt(0).toUpperCase()}
                  </div>
                  {conv.unread_count > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      backgroundColor: '#ff3b30',
                      color: 'white',
                      borderRadius: '50%',
                      minWidth: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      padding: '0 6px',
                      border: '3px solid var(--bg-card)',
                      boxShadow: '0 2px 8px rgba(255, 59, 48, 0.4)',
                      animation: 'pulse 2s infinite'
                    }}>
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-primary)',
                  marginTop: '0.5rem',
                  textAlign: 'center',
                  fontWeight: selectedConversation?.user.id === conv.user.id ? '600' : '400',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '70px'
                }}>
                  {conv.user.username}
                </div>
              </div>
            ))
          )}
        </div>

        {selectedConversation ? (
          <>
            {/* Messages Container */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Messages Area */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Chat Header with Call Buttons */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 2rem',
                  borderBottom: '2px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      backgroundImage: selectedConversation.user.profile_pic && selectedConversation.user.profile_pic !== 'default.jpg'
                        ? `url(${selectedConversation.user.profile_pic})`
                        : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}>
                      {(!selectedConversation.user.profile_pic || selectedConversation.user.profile_pic === 'default.jpg')
                        && selectedConversation.user.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                        {selectedConversation.user.username}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Active now
                      </p>
                    </div>
                  </div>
                  
                  {/* Call Buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => initiateCall('audio')}
                      style={{
                        padding: '0.75rem 1.25rem',
                        background: 'transparent',
                        border: '2px solid var(--primary-color)',
                        borderRadius: '12px',
                        color: 'var(--primary-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--primary-color)';
                        e.currentTarget.style.color = 'white';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--primary-color)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <PhoneIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                      Audio Call
                    </button>
                    
                    <button
                      onClick={() => initiateCall('video')}
                      style={{
                        padding: '0.75rem 1.25rem',
                        background: 'var(--primary-gradient)',
                        border: 'none',
                        borderRadius: '12px',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                      }}
                    >
                      <VideoCameraIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                      Video Call
                    </button>
                  </div>
                </div>
                
                {/* Messages List */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  background: 'linear-gradient(to bottom, var(--bg-primary) 0%, var(--bg-card) 100%)'
                }}>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      style={{
                        display: 'flex',
                        justifyContent: message.sender.id === user.id ? 'flex-end' : 'flex-start'
                      }}
                      onClick={() => {
                        if (!message.is_read && message.sender.id !== user.id) {
                          markAsRead(message.id);
                        }
                      }}
                    >
                      <div style={{
                        maxWidth: '70%',
                        padding: message.message_type === 'text' ? '1rem 1.25rem' : '0.75rem',
                        borderRadius: message.sender.id === user.id ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                        backgroundColor: message.sender.id === user.id
                          ? 'var(--primary-color)'
                          : 'var(--bg-secondary)',
                        color: message.sender.id === user.id
                          ? 'white'
                          : 'var(--text-primary)',
                        border: message.sender.id === user.id
                          ? 'none'
                          : '1px solid var(--border-color)',
                        boxShadow: message.sender.id === user.id
                          ? '0 2px 8px rgba(0, 0, 0, 0.1)'
                          : '0 1px 4px rgba(0, 0, 0, 0.05)',
                        transition: 'transform 0.2s ease',
                        cursor: message.sender.id !== user.id && !message.is_read ? 'pointer' : 'default'
                      }}>
                        {/* Image Message */}
                        {message.message_type === 'image' && (
                          <div style={{ position: 'relative' }}>
                            <div style={{
                              position: 'relative',
                              width: '280px',
                              aspectRatio: '9 / 16',
                              overflow: 'hidden',
                              borderRadius: '12px',
                              backgroundColor: 'var(--bg-secondary)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                            }}>
                              <img 
                                src={message.media_url} 
                                alt="Shared" 
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                              {/* Download Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const link = document.createElement('a');
                                  link.href = message.media_url;
                                  link.download = `image_${message.id}.jpg`;
                                  link.target = '_blank';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '12px',
                                  right: '12px',
                                  padding: '0.625rem',
                                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                  backdropFilter: 'blur(8px)',
                                  border: 'none',
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                                  e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                              >
                                <ArrowDownTrayIcon style={{ width: '20px', height: '20px', color: 'white' }} />
                              </button>
                            </div>
                            {message.content && message.content !== 'Sent an image' && (
                              <div style={{ marginTop: '0.5rem' }}>{message.content}</div>
                            )}
                          </div>
                        )}
                        
                        {/* Audio Message */}
                        {message.message_type === 'audio' && (
                          <div>
                            <audio controls style={{ maxWidth: '100%' }}>
                              <source src={message.media_url} type="audio/webm" />
                            </audio>
                            {message.content && message.content !== 'Voice message' && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                {message.content}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Text Message */}
                        {message.message_type === 'text' && (
                          <div>{message.content}</div>
                        )}
                        
                        {/* Timestamp and Status */}
                        <div style={{
                          fontSize: '0.7rem',
                          opacity: 0.7,
                          marginTop: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          {formatTime(message.created_at)}
                          {message.sender.id === user.id && message.is_read && (
                            <CheckIcon style={{ width: '12px', height: '12px' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Area */}
                <div style={{
                  padding: '1.5rem',
                  borderTop: '2px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  background: 'linear-gradient(to top, var(--bg-card) 0%, var(--bg-primary) 100%)'
                }}>
                  {/* Audio Recording Preview */}
                  {audioBlob && (
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <MicrophoneIcon style={{ width: '20px', height: '20px', color: 'var(--primary-color)' }} />
                      <span style={{ flex: 1, fontSize: '0.875rem' }}>Voice message ready</span>
                      <button
                        onClick={cancelRecording}
                        style={{
                          padding: '0.25rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <XMarkIcon style={{ width: '20px', height: '20px' }} />
                      </button>
                    </div>
                  )}

                  {/* Input Form */}
                  <form onSubmit={sendMessage} style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center'
                  }}>
                    {/* Image Upload Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSending}
                      style={{
                        padding: '0.875rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        cursor: isSending ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-primary)',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        opacity: isSending ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => !isSending && (e.currentTarget.style.transform = 'scale(1.05)')}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <PhotoIcon style={{ width: '20px', height: '20px' }} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />

                    {/* Voice Recording Button */}
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isSending}
                      style={{
                        padding: '0.875rem',
                        backgroundColor: isRecording ? '#ef4444' : 'var(--bg-secondary)',
                        border: isRecording ? '2px solid #dc2626' : '1px solid var(--border-color)',
                        borderRadius: '12px',
                        cursor: isSending ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: isRecording ? 'white' : 'var(--text-primary)',
                        animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                        transition: 'all 0.2s ease',
                        boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.5)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                        opacity: isSending ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => !isSending && !isRecording && (e.currentTarget.style.transform = 'scale(1.05)')}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <MicrophoneIcon style={{ width: '20px', height: '20px' }} />
                    </button>

                    {/* Text Input */}
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      disabled={isSending || isRecording}
                      style={{
                        flex: 1,
                        padding: '0.875rem 1.25rem',
                        border: '2px solid var(--border-color)',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                    />

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={(!newMessage.trim() && !audioBlob) || isSending}
                      style={{
                        padding: '0.875rem 1.75rem',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: (!newMessage.trim() && !audioBlob) || isSending ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: (!newMessage.trim() && !audioBlob) || isSending ? 0.5 : 1,
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                      }}
                      onMouseEnter={(e) => {
                        if (!(!newMessage.trim() && !audioBlob) && !isSending) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                      }}
                    >
                      <PaperAirplaneIcon style={{ width: '20px', height: '20px' }} />
                      Send
                    </button>
                  </form>
                </div>
              </div>

              {/* Shared Media Sidebar */}
              {showMediaGallery && (
                <div style={{
                  width: '300px',
                  borderLeft: '1px solid var(--border-color)',
                  overflowY: 'auto',
                  padding: '1rem'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Shared Media (24h)</h3>
                    <button
                      onClick={() => setShowMediaGallery(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem'
                      }}
                    >
                      <XMarkIcon style={{ width: '20px', height: '20px' }} />
                    </button>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.5rem'
                  }}>
                    {sharedMedia.filter(m => m.message_type === 'image').map((media) => (
                      <div key={media.id} style={{ position: 'relative' }}>
                        <img
                          src={media.media_url}
                          alt="Shared"
                          style={{
                            width: '100%',
                            aspectRatio: '1',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                          onClick={() => window.open(media.media_url, '_blank')}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '4px',
                          fontSize: '0.7rem',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {formatTime(media.created_at)}
                        </div>
                      </div>
                    ))}
                    {sharedMedia.filter(m => m.message_type === 'audio').map((media) => (
                      <div
                        key={media.id}
                        style={{
                          padding: '1rem',
                          backgroundColor: 'var(--bg-secondary)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                      >
                        <MicrophoneIcon style={{ width: '24px', height: '24px', color: 'var(--primary-color)' }} />
                        <audio controls style={{ width: '100%', height: '30px' }}>
                          <source src={media.media_url} type="audio/webm" />
                        </audio>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {formatTime(media.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {sharedMedia.length === 0 && (
                    <div style={{
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      padding: '2rem 0'
                    }}>
                      No shared media in the last 24 hours
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Toggle Media Gallery Button */}
            <button
              onClick={() => {
                setShowMediaGallery(!showMediaGallery);
                if (!showMediaGallery && selectedConversation) {
                  fetchSharedMedia(selectedConversation.user.id);
                }
              }}
              style={{
                position: 'absolute',
                right: '2rem',
                top: '130px',
                padding: '0.75rem 1.25rem',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 10
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
            >
              <DocumentIcon style={{ width: '16px', height: '16px' }} />
              {showMediaGallery ? 'Hide' : 'Show'} Media
            </button>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-card) 100%)'
          }}>
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ 
                fontSize: '4rem', 
                marginBottom: '1.5rem',
                animation: 'float 3s ease-in-out infinite'
              }}>💬</div>
              <div style={{ 
                fontSize: '1.5rem', 
                marginBottom: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-primary)'
              }}>
                Select a conversation
              </div>
              <div style={{ fontSize: '1rem', opacity: 0.7 }}>Choose someone from the top bar to start messaging</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Video Call Component */}
      {remoteCallUserId && (
        <VideoCall
          key={`call-${remoteCallUserId}-${callType}`}
          isOpen={isCallOpen}
          onClose={handleCloseCall}
          callType={callType}
          remoteUserId={remoteCallUserId}
          isInitiator={isCallInitiator}
        />
      )}
      
      {/* Incoming Call Modal */}
      {incomingCall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '24px',
            padding: '2.5rem',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            animation: 'fadeInScale 0.3s ease-out'
          }}>
            {/* Caller Avatar */}
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              margin: '0 auto 1.5rem',
              backgroundColor: 'var(--primary-color)',
              backgroundImage: incomingCall.caller?.profile_pic && incomingCall.caller.profile_pic !== 'default.jpg'
                ? `url(${incomingCall.caller.profile_pic})`
                : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              color: 'white',
              fontWeight: 'bold',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
              animation: 'pulse 2s infinite'
            }}>
              {(!incomingCall.caller?.profile_pic || incomingCall.caller.profile_pic === 'default.jpg')
                && incomingCall.caller?.username?.charAt(0).toUpperCase()}
            </div>
            
            {/* Call Type Icon */}
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>
              {incomingCall.callType === 'video' ? '📹' : '📞'}
            </div>
            
            {/* Caller Info */}
            <h2 style={{
              margin: '0 0 0.5rem 0',
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'var(--text-primary)'
            }}>
              {incomingCall.caller?.username}
            </h2>
            
            <p style={{
              margin: '0 0 2rem 0',
              fontSize: '1.1rem',
              color: 'var(--text-secondary)'
            }}>
              Incoming {incomingCall.callType} call...
            </p>
            
            {/* Call Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button
                onClick={rejectCall}
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: '#ff3b30',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(255, 59, 48, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 59, 48, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 59, 48, 0.3)';
                }}
              >
                <XMarkIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                Decline
              </button>
              
              <button
                onClick={acceptCall}
                style={{
                  padding: '1rem 2rem',
                  background: 'linear-gradient(135deg, #34c759 0%, #30d158 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(52, 199, 89, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 199, 89, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 199, 89, 0.3)';
                }}
              >
                {incomingCall.callType === 'video' ? (
                  <VideoCameraIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                ) : (
                  <PhoneIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                )}
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
