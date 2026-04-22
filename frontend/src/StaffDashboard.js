import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

function StaffDashboard() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    instructions: '',
    studentId: '',
    studentGroup: '',
    dueDate: '',
    assignmentType: 'individual' // 'individual' or 'group'
  });

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
    
    if (!userData || !token || userData.role !== 'staff') {
      window.location.href = '/';
      return;
    }
    
    setUser(userData);
    loadStudents();
    loadTasks();
  }, []);

  const loadStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/students`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setStudents(data);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/tasks/staff`, {
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

  // Function to assign task to entire group
  const assignTaskToGroup = async (groupName, groupStudents) => {
    try {
      const taskTitle = prompt(`Enter task title for Group ${groupName}:`);
      if (!taskTitle) return;

      const taskDescription = prompt(`Enter task description for Group ${groupName}:`);
      if (!taskDescription) return;

      const dueDate = prompt(`Enter due date for Group ${groupName} (YYYY-MM-DD):`);
      if (!dueDate) return;

      const instructions = prompt(`Enter instructions (optional) for Group ${groupName}:`) || '';

      const token = localStorage.getItem('token');
      
      // Prepare task data for group assignment
      const taskData = {
        title: taskTitle,
        description: taskDescription,
        instructions: instructions,
        dueDate: dueDate,
        assignmentType: 'group',
        studentGroup: groupName,
        assignedTo: `Group ${groupName}`,
        assignedBy: user.name
      };

      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      });
      
      if (response.ok) {
        alert(`✅ Task assigned successfully to Group ${groupName}!`);
        loadTasks(); // Refresh tasks list
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to assign task: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error assigning task to group:', error);
      alert('Error assigning task to group');
    }
  };

  // Group students by their student ID prefix
  const getStudentGroups = () => {
    const groups = {};
    
    students.forEach(student => {
      if (student.studentId) {
        // Extract group prefix (first 4-5 characters)
        const groupPrefix = student.studentId.substring(0, 4).toUpperCase();
        if (!groups[groupPrefix]) {
          groups[groupPrefix] = [];
        }
        groups[groupPrefix].push(student);
      }
    });
    
    return groups;
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Prepare task data based on assignment type
      const taskData = {
        title: newTask.title,
        description: newTask.description,
        instructions: newTask.instructions,
        dueDate: newTask.dueDate,
        assignmentType: newTask.assignmentType,
        assignedBy: user.name
      };

      // Add individual or group assignment
      if (newTask.assignmentType === 'individual') {
        const selectedStudent = students.find(s => s.studentId === newTask.studentId);
        taskData.studentId = newTask.studentId;
        taskData.assignedTo = selectedStudent ? `${selectedStudent.name} (${selectedStudent.studentId})` : 'Unknown Student';
      } else {
        taskData.studentGroup = newTask.studentGroup;
        taskData.assignedTo = `Group ${newTask.studentGroup}`;
      }

      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      });
      
      if (response.ok) {
        alert(`Task assigned successfully to ${newTask.assignmentType === 'individual' ? 'student' : 'group'}!`);
        setNewTask({
          title: '',
          description: '',
          instructions: '',
          studentId: '',
          studentGroup: '',
          dueDate: '',
          assignmentType: 'individual'
        });
        loadTasks();
      } else {
        const errorData = await response.json();
        alert(`Failed to assign task: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error assigning task:', error);
      alert('Error assigning task');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  const studentGroups = getStudentGroups();

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>🎓 College Management System - Staff Panel</h1>
        <div className="user-info">
          Welcome, <strong>{user.name}</strong> (Staff)
          <button onClick={logout} className="logout-btn">🚪 Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Student Groups Overview */}
        <div className="content-section">
          <h2>👥 Student Groups Overview</h2>
          <div className="groups-grid">
            {Object.keys(studentGroups).length === 0 ? (
              <div className="no-groups">
                <p>No student groups found</p>
              </div>
            ) : (
              Object.entries(studentGroups).map(([groupName, groupStudents]) => (
                <div key={groupName} className="group-card">
                  <div className="group-header">
                    <h3>Group {groupName}</h3>
                    <span className="group-count">{groupStudents.length} students</span>
                  </div>
                  <div className="group-students">
                    {groupStudents.map(student => (
                      <div key={student._id} className="student-item">
                        <span className="student-name">{student.name}</span>
                        <span className="student-id">{student.studentId}</span>
                      </div>
                    ))}
                  </div>
                  <div className="group-actions">
                    <button 
                      className="assign-group-btn"
                      onClick={() => assignTaskToGroup(groupName, groupStudents)}
                      title={`Assign task to all students in Group ${groupName}`}
                    >
                      📝 Assign Task to Group
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Assign Task Section */}
        <div className="content-section">
          <h2>📤 Assign New Task</h2>
          <form onSubmit={handleAssignTask} className="task-form">
            <div className="form-row">
              <div className="form-group">
                <label>Assignment Type *</label>
                <select
                  value={newTask.assignmentType}
                  onChange={(e) => setNewTask({...newTask, assignmentType: e.target.value, studentId: '', studentGroup: ''})}
                  required
                  className="form-select"
                >
                  <option value="individual">Individual Assignment</option>
                  <option value="group">Group Assignment</option>
                </select>
              </div>
              <div className="form-group">
                <label>Due Date *</label>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  required
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Task Title *</label>
              <input
                type="text"
                placeholder="Enter task title"
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Description *</label>
              <textarea
                placeholder="Enter task description"
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                required
                className="form-textarea"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Instructions (optional)</label>
              <textarea
                placeholder="Enter specific instructions for the task"
                value={newTask.instructions}
                onChange={(e) => setNewTask({...newTask, instructions: e.target.value})}
                className="form-textarea"
                rows="3"
              />
            </div>

            {newTask.assignmentType === 'individual' ? (
              <div className="form-group">
                <label>Select Student *</label>
                <select
                  value={newTask.studentId}
                  onChange={(e) => setNewTask({...newTask, studentId: e.target.value})}
                  required
                  className="form-select"
                >
                  <option value="">Choose a student</option>
                  {students.map(student => (
                    <option key={student.studentId} value={student.studentId}>
                      {student.name} ({student.studentId}) - {student.studentId?.substring(0, 4)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Select Group *</label>
                <select
                  value={newTask.studentGroup}
                  onChange={(e) => setNewTask({...newTask, studentGroup: e.target.value})}
                  required
                  className="form-select"
                >
                  <option value="">Choose a group</option>
                  {Object.keys(studentGroups).map(groupName => (
                    <option key={groupName} value={groupName}>
                      Group {groupName} ({studentGroups[groupName].length} students)
                    </option>
                  ))}
                </select>
                {newTask.studentGroup && (
                  <div className="group-info">
                    <p><strong>Group Members:</strong></p>
                    <ul>
                      {studentGroups[newTask.studentGroup]?.map(student => (
                        <li key={student._id}>{student.name} ({student.studentId})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="assign-btn">
              {newTask.assignmentType === 'individual' ? '📤 Assign to Student' : '📤 Assign to Group'}
            </button>
          </form>
        </div>

        {/* Assigned Tasks Section */}
        <div className="content-section">
          <h2>📋 Assigned Tasks</h2>
          <div className="tasks-table-container">
            {tasks.length === 0 ? (
              <div className="no-tasks">
                <p>No tasks assigned yet</p>
              </div>
            ) : (
              <table className="tasks-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Assigned To</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Assigned Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task._id} className="table-row">
                      <td className="table-cell">
                        <strong>{task.title}</strong>
                        {task.instructions && (
                          <div className="task-instructions">
                            <small>Instructions: {task.instructions}</small>
                          </div>
                        )}
                      </td>
                      <td className="table-cell">
                        {task.assignmentType === 'group' ? (
                          <span className="group-assignment">
                            👥 {task.assignedTo}
                          </span>
                        ) : (
                          <span className="individual-assignment">
                            👤 {task.assignedTo}
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`assignment-type ${task.assignmentType}`}>
                          {task.assignmentType === 'group' ? 'Group' : 'Individual'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`status-${task.status}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="table-cell">
                        {new Date(task.dueDate).toLocaleDateString()}
                      </td>
                      <td className="table-cell">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StaffDashboard;