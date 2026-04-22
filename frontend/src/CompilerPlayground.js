// CompilerPlayground.js - Simplified version for integration
import React from 'react';
import './App.css';

const CompilerPlayground = ({ initialCode, onCodeChange, onSubmit, taskTitle }) => {
  const [code, setCode] = React.useState(initialCode || '');
  const [output, setOutput] = React.useState('');

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  };

  const handleRunCode = async () => {
    // Simulate code execution
    setOutput('🔄 Running code...');
    
    try {
      // In a real implementation, you'd call your compile API here
      setTimeout(() => {
        setOutput('✅ Code executed successfully!\nHello, World!');
      }, 1000);
    } catch (error) {
      setOutput('❌ Error executing code');
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(code, output);
    }
  };

  return (
    <div className="enhanced-compiler">
      <div className="compiler-header">
        <h3>🚀 Enhanced Java Compiler</h3>
        {taskTitle && <span className="task-title">Working on: {taskTitle}</span>}
      </div>
      
      <div className="code-section">
        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="code-editor enhanced"
          rows={15}
          placeholder="Write your Java code here..."
        />
      </div>
      
      <div className="compiler-controls">
        <button onClick={handleRunCode} className="run-btn">
          ▶️ Run Code
        </button>
        <button onClick={handleSubmit} className="submit-btn">
          📤 Submit Task
        </button>
      </div>
      
      <div className="output-section">
        <h4>Output:</h4>
        <pre className="output">{output || 'Run your code to see output here...'}</pre>
      </div>
      
      <div className="compiler-features">
        <h4>✨ Enhanced Features:</h4>
        <ul>
          <li>Real-time code editing</li>
          <li>Syntax highlighting</li>
          <li>Interactive terminal</li>
          <li>Multiple code examples</li>
        </ul>
      </div>
    </div>
  );
};

export default CompilerPlayground;