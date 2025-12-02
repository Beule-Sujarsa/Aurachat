import React, { useState } from 'react';
import { searchUsers } from '../services/api';

const Messages = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query || query.trim().length === 0) return;
    try {
      const users = await searchUsers(query.trim());
      setResults(users || []);
    } catch (err) {
      console.error('User search failed', err);
      setResults([]);
    }
  };

  const startConversation = (user) => {
    setSelectedUser(user);
    setMessages([]); // clear or load from backend when implemented
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const msg = {
      id: Date.now(),
      sender_id: 'me',
      recipient_id: selectedUser.id,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
      read: false
    };

    // Optimistic UI: append locally. Replace with real API call later.
    setMessages(prev => [...prev, msg]);
    setNewMessage('');
  };

  return (
    <div className="messages-page container" style={{ padding: '2rem 0' }}>
      <h2 style={{ marginBottom: '1rem' }}>Messages</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem' }}>
        <div className="conversations" style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
          <form onSubmit={handleSearch} style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Find users to chat with (username or name)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
            <div style={{ marginTop: '0.5rem' }}>
              <button className="btn btn-primary" type="submit">Search</button>
            </div>
          </form>

          <div>
            {results.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No users found. Try a different query.</p>}
            {results.map(u => (
              <div key={u.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{u.username}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{u.full_name}</div>
                </div>
                <div>
                  <button className="btn btn-outline" onClick={() => startConversation(u)}>Chat</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="thread" style={{ paddingLeft: '1rem' }}>
          {!selectedUser ? (
            <div style={{ color: 'var(--text-secondary)' }}>
              Select a user to start a conversation.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0 }}>{selectedUser.full_name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>@{selectedUser.username}</span></h3>
              </div>

              <div className="messages-list" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                {messages.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>No messages yet — say hello!</div>}
                {messages.map(m => (
                  <div key={m.id} style={{ marginBottom: '0.75rem', textAlign: m.sender_id === 'me' ? 'right' : 'left' }}>
                    <div style={{ display: 'inline-block', background: m.sender_id === 'me' ? 'var(--primary-color)' : 'var(--bg-card)', color: m.sender_id === 'me' ? 'white' : 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '12px' }}>
                      {m.content}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSend} style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Message ${selectedUser.username}...`}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
                <button className="btn btn-primary" type="submit">Send</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
