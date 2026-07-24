import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform
} from 'react-native';

const BACKEND_URL = 'http://10.0.2.2:5000'; // Standard Android emulator localhost fallback, or use http://localhost:5000

export default function DashboardScreen() {
  const [cpu, setCpu] = useState('0%');
  const [users, setUsers] = useState(0);
  const [uptime, setUptime] = useState('00:00:00');
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef(null);

  // Animated width for the CPU load progress bar
  const cpuProgressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Poll metrics & messages on mobile, since EventSource is not always natively available in plain React Native without polyfills
    // This is the industry-standard, safe approach for RN components
    fetchInitialData();
    
    const interval = setInterval(() => {
      fetchMetrics();
      fetchMessagesUpdates();
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Update animated progress bar when CPU load state changes
  useEffect(() => {
    const numericValue = parseInt(cpu.replace('%', ''), 10) || 0;
    Animated.timing(cpuProgressAnim, {
      toValue: numericValue / 100,
      duration: 600,
      useNativeDriver: false // Layout width property doesn't support native driver in RN
    }).current.start();
  }, [cpu]);

  const fetchInitialData = async () => {
    try {
      const metricsResponse = await fetch(`${BACKEND_URL}/api/metrics`);
      if (metricsResponse.ok) {
        const data = await metricsResponse.json();
        setCpu(data.cpuLoad);
        setUsers(data.activeUsers);
        setUptime(data.uptime);
        setIsConnected(true);
      }

      const messagesResponse = await fetch(`${BACKEND_URL}/api/messages`);
      if (messagesResponse.ok) {
        const msgs = await messagesResponse.json();
        setMessages(msgs);
      }
    } catch (error) {
      console.warn('Initial connection failed. Attempting localhost default...');
      // Fallback to standard web localhost for testing
      try {
        const localURL = 'http://localhost:5000';
        const resM = await fetch(`${localURL}/api/metrics`);
        const resC = await fetch(`${localURL}/api/messages`);
        if (resM.ok && resC.ok) {
          const metricsData = await resM.json();
          const msgsData = await resC.json();
          setCpu(metricsData.cpuLoad);
          setUsers(metricsData.activeUsers);
          setUptime(metricsData.uptime);
          setMessages(msgsData);
          setIsConnected(true);
        }
      } catch (err) {
        setIsConnected(false);
      }
    }
  };

  const fetchMetrics = async () => {
    try {
      // Try emulation URL first, fall back to standard localhost
      let url = `${BACKEND_URL}/api/metrics`;
      let response;
      try {
        response = await fetch(url);
      } catch {
        url = 'http://localhost:5000/api/metrics';
        response = await fetch(url);
      }

      if (response.ok) {
        const data = await response.json();
        setCpu(data.cpuLoad);
        setUsers(data.activeUsers);
        setUptime(data.uptime);
        setIsConnected(true);
      }
    } catch {
      setIsConnected(false);
    }
  };

  const fetchMessagesUpdates = async () => {
    try {
      let url = `${BACKEND_URL}/api/messages`;
      let response;
      try {
        response = await fetch(url);
      } catch {
        url = 'http://localhost:5000/api/messages';
        response = await fetch(url);
      }

      if (response.ok) {
        const msgs = await response.json();
        
        // Only trigger typing indicator state if we expect bot to answer and there is a delay
        if (msgs.length > messages.length) {
          const lastNew = msgs[msgs.length - 1];
          if (lastNew.sender === 'bot') {
            setIsTyping(false);
          }
          setMessages(msgs);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
    } catch (err) {
      console.log('Error updating mobile messages:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();
    setInputText('');

    // Add local optimistic message
    const tempId = `mobile-temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      sender: 'user',
      text: messageText,
      timestamp: new Date().toISOString(),
      status: 'sending'
    };

    const updatedMsgs = [...messages, tempMsg];
    setMessages(updatedMsgs);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    // Show bot typing simulation after 2s
    setTimeout(() => {
      setIsTyping(true);
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 2000);

    try {
      let url = `${BACKEND_URL}/api/messages`;
      let baseUrl = BACKEND_URL;
      try {
        await fetch(url, { method: 'HEAD' });
      } catch {
        url = 'http://localhost:5000/api/messages';
        baseUrl = 'http://localhost:5000';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: messageText, sender: 'user' })
      });

      if (response.ok) {
        const realMsg = await response.json();
        setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      }
    } catch (error) {
      console.error('Failed to post mobile message:', error);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
    }
  };

  const renderStatusTicks = (status) => {
    switch (status) {
      case 'sending':
        return <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" style={styles.tickIndicator} />;
      case 'sent':
        return <Text style={styles.statusTick}>✓</Text>;
      case 'delivered':
        return <Text style={styles.statusTick}>✓✓</Text>;
      case 'read':
        return <Text style={[styles.statusTick, styles.statusTickRead]}>✓✓</Text>;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Mobile Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.connectionIndicator, isConnected && styles.connectedGlow]} />
            <Text style={styles.headerTitle}>System Dashboard</Text>
          </View>
          <View style={[styles.badge, isConnected ? styles.badgeConnected : styles.badgeDisconnected]}>
            <Text style={styles.badgeText}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
          </View>
        </View>

        {/* Dashboard Metrics Row */}
        <View style={styles.metricsRow}>
          {/* CPU Load Metric */}
          <View style={[styles.metricCard, styles.cpuCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>📊</Text>
              <Text style={styles.cardLabel}>CPU LOAD</Text>
            </View>
            <Text style={styles.cardValue}>{cpu}</Text>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: cpuProgressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}
              />
            </View>
          </View>

          {/* Active Users Metric */}
          <View style={[styles.metricCard, styles.usersCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>👥</Text>
              <Text style={styles.cardLabel}>ACTIVE USERS</Text>
            </View>
            <Text style={styles.cardValue}>
              {users.toLocaleString()}
            </Text>
          </View>

          {/* Uptime Metric */}
          <View style={[styles.metricCard, styles.uptimeCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>⏱️</Text>
              <Text style={styles.cardLabel}>UPTIME</Text>
            </View>
            <Text style={styles.cardValue} numberOfLines={1}>{uptime}</Text>
          </View>
        </View>

        {/* Support Chat Workspace */}
        <View style={styles.chatSection}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatHeaderTitle}>Support Assistant</Text>
            <Text style={styles.chatHeaderStatus}>• Online</Text>
          </View>

          {/* Chat Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroller}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((item) => {
              const isMe = item.sender === 'user';
              const isSys = item.sender === 'system';
              const timeString = new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });

              if (isSys) {
                return (
                  <View key={item.id} style={styles.systemRow}>
                    <Text style={styles.systemText}>{item.text}</Text>
                  </View>
                );
              }

              return (
                <View key={item.id} style={[styles.messageRow, isMe ? styles.rowMe : styles.rowThem]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.messageText, isMe ? styles.textMe : styles.textThem]}>
                      {item.text}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={[styles.metaTime, isMe ? styles.timeMe : styles.timeThem]}>
                        {timeString}
                      </Text>
                      {isMe && renderStatusTicks(item.status)}
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Bouncing Dots Simulation */}
            {isTyping && (
              <View style={styles.typingBubble}>
                <Text style={styles.typingText}>Support Assistant is typing...</Text>
              </View>
            )}
          </ScrollView>

          {/* Message Composer Footer */}
          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              placeholder="Type message to assistant..."
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputText.trim()}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0b0f19'
  },
  container: {
    flex: 1,
    backgroundColor: '#0b0f19'
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  connectionIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginRight: 10
  },
  connectedGlow: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12
  },
  badgeConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981'
  },
  badgeDisconnected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    gap: 8
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(22, 30, 49, 0.7)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  cpuCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6'
  },
  usersCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#10b981'
  },
  uptimeCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  cardIcon: {
    fontSize: 12,
    marginRight: 4
  },
  cardLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  cardValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: 2
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2
  },
  chatSection: {
    flex: 1,
    backgroundColor: 'rgba(22, 30, 49, 0.5)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden'
  },
  chatHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)'
  },
  chatHeaderTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 6
  },
  chatHeaderStatus: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600'
  },
  chatScroller: {
    flex: 1
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24
  },
  messageRow: {
    width: '100%',
    marginVertical: 6,
    flexDirection: 'row'
  },
  rowMe: {
    justifyContent: 'flex-end'
  },
  rowThem: {
    justifyContent: 'flex-start'
  },
  bubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16
  },
  bubbleMe: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  bubbleThem: {
    backgroundColor: '#1f2937',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18
  },
  textMe: {
    color: '#ffffff'
  },
  textThem: {
    color: '#f3f4f6'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4
  },
  metaTime: {
    fontSize: 10
  },
  timeMe: {
    color: 'rgba(255, 255, 255, 0.6)'
  },
  timeThem: {
    color: '#9ca3af'
  },
  statusTick: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: 'bold'
  },
  statusTickRead: {
    color: '#60a5fa'
  },
  tickIndicator: {
    transform: [{ scale: 0.65 }]
  },
  systemRow: {
    alignSelf: 'center',
    marginVertical: 10,
    backgroundColor: 'rgba(31, 41, 55, 0.5)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  systemText: {
    color: '#9ca3af',
    fontSize: 11
  },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  typingText: {
    color: '#9ca3af',
    fontSize: 12,
    fontStyle: 'italic'
  },
  composerRow: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(15, 23, 42, 0.3)'
  },
  input: {
    flex: 1,
    height: 38,
    backgroundColor: '#0f172a',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 19,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14
  },
  sendButton: {
    height: 38,
    paddingHorizontal: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  sendButtonDisabled: {
    backgroundColor: '#1e293b',
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  }
});
