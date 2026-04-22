import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [javaCode, setJavaCode] = useState('');
  const [output, setOutput] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [viewingSubmission, setViewingSubmission] = useState(false);
  const [submissionToView, setSubmissionToView] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [useWebSocket, setUseWebSocket] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  
  const websocket = useRef(null);
  const outputEndRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    if (!useWebSocket) return;

    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
    
    try {
      websocket.current = new WebSocket(wsUrl);

      websocket.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setOutput(prev => prev + '🔗 Connected to real-time compiler\n');
      };

      websocket.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setIsCompiling(false);
        setIsExecuting(false);
        setWaitingForInput(false);
      };

      websocket.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setUseWebSocket(false);
      };

      return () => {
        if (websocket.current) {
          websocket.current.close();
        }
      };
    } catch (error) {
      console.error('WebSocket setup error:', error);
      setUseWebSocket(false);
    }
  }, [useWebSocket]);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'status':
        setOutput(prev => prev + `📢 ${data.message}\n`);
        break;
      
      case 'output':
        setOutput(prev => prev + data.output);
        // Auto-detect when program is waiting for input
        if (data.output.includes('Enter') || data.output.includes('enter') || 
            data.output.includes('Input') || data.output.includes('input') ||
            data.output.trim().endsWith(':') || data.output.trim().endsWith('?')) {
          setWaitingForInput(true);
        }
        break;
      
      case 'error':
        setOutput(prev => prev + `❌ ${data.error}\n`);
        setIsCompiling(false);
        setIsExecuting(false);
        setWaitingForInput(false);
        break;
      
      case 'input_required':
        setOutput(prev => prev + `\n📥 ${data.prompt || 'Program is waiting for input:'}`);
        setWaitingForInput(true);
        setIsExecuting(true);
        break;
      
      case 'program_exit':
        setOutput(prev => prev + `\n${data.message}\n`);
        setIsCompiling(false);
        setIsExecuting(false);
        setWaitingForInput(false);
        break;
      
      case 'compilation_success':
        setOutput(prev => prev + `✅ ${data.message}\n`);
        setIsCompiling(false);
        setIsExecuting(true);
        break;
      
      case 'execution_started':
        setOutput(prev => prev + `🚀 ${data.message}\n`);
        setIsExecuting(true);
        break;

      case 'compilation_started':
        setOutput(prev => prev + `🔨 ${data.message}\n`);
        break;

      default:
        console.log('Unknown message type:', data);
    }

    // Auto-scroll to bottom of output
    setTimeout(() => {
      if (outputEndRef.current) {
        outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
    
    if (!userData || !token || userData.role !== 'student') {
      window.location.href = '/';
      return;
    }
    
    setUser(userData);
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/tasks/student`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const calculateProgress = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'submitted' || task.status === 'completed').length;
    const pendingTasks = tasks.filter(task => task.status === 'pending').length;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      progressPercentage
    };
  };

  const runJavaCode = async () => {
    if (!javaCode.trim()) {
      setOutput('❌ Please write some Java code before running.');
      return;
    }

    if (!useWebSocket || !isConnected) {
      setOutput('❌ Real-time compiler not available. Please enable WebSocket connection.');
      return;
    }

    setIsCompiling(true);
    setIsExecuting(false);
    setWaitingForInput(false);
    setOutput('🚀 Starting compilation and execution...\n');

    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify({
        type: 'compile_and_run',
        code: javaCode,
        language: 'java'
      }));
    } else {
      setOutput('❌ WebSocket connection not available. Please retry connection.');
      setIsCompiling(false);
    }
  };

  const sendInput = () => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN && userInput.trim()) {
      websocket.current.send(JSON.stringify({
        type: 'user_input',
        input: userInput
      }));
      setUserInput('');
      setWaitingForInput(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && waitingForInput) {
      sendInput();
    }
  };

  const stopExecution = () => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify({
        type: 'stop_execution'
      }));
    }
    setIsCompiling(false);
    setIsExecuting(false);
    setWaitingForInput(false);
    setOutput(prev => prev + '\n⏹️ Execution stopped by user\n');
  };

  const submitTask = async (taskId) => {
    if (!javaCode.trim()) {
      alert('Please write some code before submitting the task.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'submitted',
          code: javaCode,
          output: output
        })
      });
      
      if (response.ok) {
        alert('Task submitted successfully!');
        loadTasks();
        setActiveTask(null);
        setViewingSubmission(false);
        // Reset compiler state
        setIsCompiling(false);
        setIsExecuting(false);
        setWaitingForInput(false);
      } else {
        alert('Failed to submit task. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting task:', error);
      alert('Error submitting task. Please check your connection.');
    }
  };

  const clearCode = () => {
    setJavaCode('');
    setOutput('');
    setIsCompiling(false);
    setIsExecuting(false);
    setWaitingForInput(false);
  };

  const clearOutput = () => {
    setOutput('');
  };

  const retryWebSocket = () => {
    setUseWebSocket(true);
    setIsConnected(false);
    setOutput(prev => prev + '\n🔄 Retrying WebSocket connection...\n');
  };

  const viewSubmission = (task) => {
    setSubmissionToView(task);
    setViewingSubmission(true);
    setJavaCode(task.submission?.code || '');
    setOutput(task.submission?.output || '');
    setIsCompiling(false);
    setIsExecuting(false);
    setWaitingForInput(false);
  };

  const closeSubmissionView = () => {
    setViewingSubmission(false);
    setSubmissionToView(null);
    setJavaCode('');
    setOutput('');
  };

  const continueWorking = (taskId) => {
    setViewingSubmission(false);
    setSubmissionToView(null);
    setActiveTask(taskId);
    setJavaCode('');
    setOutput('');
  };

  const logout = () => {
    if (websocket.current) {
      websocket.current.close();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  const progress = calculateProgress();
  const currentTask = activeTask ? tasks.find(t => t._id === activeTask) : null;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Student Dashboard</h1>
        <div className="user-info">
          Welcome, <strong>{user.name}</strong> (Student - {user.studentId})
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="content-section">
          <div className="progress-section">
            <h2>My Progress</h2>
            <div className="progress-container">
              <div className="progress-stats">
                <div className="stat-item">
                  <div className="stat-number">{progress.totalTasks}</div>
                  <div className="stat-label">Total Tasks</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number completed">{progress.completedTasks}</div>
                  <div className="stat-label">Completed</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number pending">{progress.pendingTasks}</div>
                  <div className="stat-label">Pending</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number percentage">{progress.progressPercentage}%</div>
                  <div className="stat-label">Progress</div>
                </div>
              </div>
              
              <div className="progress-bar-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${progress.progressPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="content-section">
          <h2>My Tasks</h2>
          <div className="tasks-list">
            {tasks.length === 0 ? (
              <div className="no-tasks">
                <p>No tasks assigned yet.</p>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task._id} className={`task-card ${activeTask === task._id ? 'active' : ''}`}>
                  <div className="task-header">
                    <h3>{task.title}</h3>
                    <div className="task-status-container">
                      <span className={`status-${task.status}`}>{task.status.toUpperCase()}</span>
                      {task.status === 'submitted' && (
                        <span className="submitted-badge">Submitted</span>
                      )}
                    </div>
                  </div>
                  <p><strong>Description:</strong> {task.description}</p>
                  {task.instructions && <p><strong>Instructions:</strong> {task.instructions}</p>}
                  <p><strong>Due Date:</strong> {new Date(task.dueDate).toLocaleDateString()}</p>
                  
                  <div className="task-actions">
                    {task.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => setActiveTask(activeTask === task._id ? null : task._id)}
                          className="work-on-btn"
                        >
                          {activeTask === task._id ? 'Hide Compiler' : 'Work on Task'}
                        </button>
                        {activeTask === task._id && (
                          <button 
                            onClick={() => submitTask(task._id)}
                            className="submit-btn"
                          >
                            Submit Task
                          </button>
                        )}
                      </>
                    )}
                    {task.status === 'submitted' && (
                      <div className="submission-info">
                        <button 
                          onClick={() => viewSubmission(task)}
                          className="view-submission-btn"
                        >
                          View Submission
                        </button>
                        {task.allowResubmission !== false && (
                          <button 
                            onClick={() => continueWorking(task._id)}
                            className="resubmit-btn"
                          >
                            Resubmit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {(activeTask || viewingSubmission) && (
          <div className="content-section">
            <div className="compiler-header-section">
              <h2>
                {viewingSubmission ? 'Viewing Submission' : 'Interactive Java Compiler'} 
                {activeTask && ` - ${tasks.find(t => t._id === activeTask)?.title}`}
              </h2>
              
              <div className="connection-info">
                <span className={`status-indicator ${useWebSocket && isConnected ? 'connected' : 'http-mode'}`}>
                  {useWebSocket ? (isConnected ? '🔗 Real-time' : '🔄 Connecting...') : '🌐 HTTP'}
                </span>
                
                {!useWebSocket && (
                  <button onClick={retryWebSocket} className="retry-ws-btn">
                    Retry Real-time
                  </button>
                )}
              </div>
            </div>
            
            {viewingSubmission && (
              <div className="view-mode-notice">
                <p>Viewing submitted task - Read only</p>
                <button onClick={closeSubmissionView} className="exit-view-btn">
                  Exit View Mode
                </button>
              </div>
            )}

            <div className="compiler-container">
              <div className="compiler-header">
                <h3>{viewingSubmission ? 'Submitted Code:' : 'Write your Java code:'}</h3>
                {!viewingSubmission && (
                  <div className="compiler-controls">
                    <button onClick={clearCode} className="clear-btn">
                      Clear Code
                    </button>
                    <button onClick={clearOutput} className="clear-btn">
                      Clear Output
                    </button>
                  </div>
                )}
              </div>
              
              <textarea
                value={javaCode}
                onChange={(e) => !viewingSubmission && setJavaCode(e.target.value)}
                className={`code-editor ${viewingSubmission ? 'view-mode' : ''}`}
                rows={18}
                placeholder="Write your Java code here..."
                readOnly={viewingSubmission}
              />
              
              {!viewingSubmission && (
                <>
                  <div className="compiler-buttons">
                    <button 
                      onClick={runJavaCode} 
                      disabled={isCompiling || !isConnected}
                      className={`run-btn ${isCompiling ? 'compiling' : ''}`}
                    >
                      {isCompiling ? 'Compiling...' : isExecuting ? 'Running...' : 'Run Code'}
                    </button>
                    
                    <button 
                      onClick={stopExecution} 
                      disabled={!isCompiling && !isExecuting}
                      className="stop-btn"
                    >
                      Stop Execution
                    </button>
                  </div>

                  {waitingForInput && (
                    <div className="input-section">
                      <h4>📥 Program is waiting for input:</h4>
                      <div className="input-controls">
                        <input
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          onKeyPress={handleKeyPress}
                          className="input-field"
                          placeholder="Type your input here and press Enter..."
                          autoFocus
                        />
                        <button onClick={sendInput} className="send-input-btn">
                          Send Input
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="output-section">
                    <h3>Output:</h3>
                    <div className="output-container">
                      <pre className="output">
                        {output || 'Output will appear here...'}
                        {isCompiling && !output && '🔄 Compiling your code...'}
                      </pre>
                      <div ref={outputEndRef} />
                    </div>
                    <div className="execution-status">
                      {isCompiling && <span className="status-compiling">🔄 Compiling</span>}
                      {isExecuting && <span className="status-executing">🚀 Executing</span>}
                      {waitingForInput && <span className="status-input">📥 Waiting for input</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!activeTask && !viewingSubmission && tasks.some(task => task.status === 'pending') && (
          <div className="content-section">
            <div className="compiler-promo">
              <h3>Ready to Start Coding?</h3>
              <p>Click "Work on Task" on any pending task to open the interactive Java compiler.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;