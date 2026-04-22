import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [editingUser, setEditingUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: '',
    password: 'pass123',
    email: '',
    name: '',
    role: 'student',
    studentId: ''
  });

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
    
    if (!userData || !token || userData.role !== 'admin') {
      window.location.href = '/';
      return;
    }
    
    setUser(userData);
    loadUsers();
    loadTasks();
  }, []);

  // Auto-generate student ID when role is set to student
  useEffect(() => {
    if (newUser.role === 'student' && !newUser.studentId) {
      generateStudentId();
    }
  }, [newUser.role]);

  // Filter users when search term or users list changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(userItem =>
        userItem.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userItem.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userItem.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userItem.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userItem.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  // Get users by role
  const getUsersByRole = (role) => {
    return filteredUsers.filter(user => user.role === role);
  };

  const generateStudentId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    const studentId = `23BCS${randomNum}`;
    setNewUser(prev => ({ ...prev, studentId }));
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/admin/tasks`, {
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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Ensure student ID is properly set for student roles
      const userData = { ...newUser };
      if (userData.role !== 'student') {
        userData.studentId = null;
      }
      
      const response = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        alert('User created successfully!');
        setNewUser({
          username: '',
          password: 'pass123',
          email: '',
          name: '',
          role: 'student',
          studentId: ''
        });
        setShowUserForm(false);
        loadUsers();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Ensure student ID is properly handled
      const userData = { ...editingUser };
      if (userData.role !== 'student') {
        userData.studentId = null;
      }
      
      const response = await fetch(`${API_BASE}/admin/users/${userData._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        alert('User updated successfully!');
        setEditingUser(null);
        loadUsers();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error updating user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('User deleted successfully!');
        loadUsers();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user');
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>🎓 College Management System - Admin Panel</h1>
        <div className="user-info">
          Welcome, <strong>{user.name}</strong> (Admin)
          <button onClick={logout} className="logout-btn">🚪 Logout</button>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button 
          className={activeTab === 'users' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setActiveTab('users')}
        >
          👥 Manage Users
        </button>
        <button 
          className={activeTab === 'tasks' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setActiveTab('tasks')}
        >
          📋 All Tasks
        </button>
        <button 
          className={activeTab === 'stats' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'users' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>👥 User Management</h2>
              <button 
                onClick={() => setShowUserForm(true)} 
                className="add-user-btn"
              >
                ➕ Add New User
              </button>
            </div>

            {/* Search Bar */}
            <div className="search-container">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="🔍 Search users by name, username, email, student ID, or role..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="search-input"
                />
                {searchTerm && (
                  <button onClick={clearSearch} className="clear-search-btn">
                    ❌
                  </button>
                )}
              </div>
              <div className="search-results-info">
                Showing {filteredUsers.length} of {users.length} users
                {searchTerm && (
                  <span className="search-term">
                    for "<strong>{searchTerm}</strong>"
                  </span>
                )}
              </div>
            </div>

            {/* Add User Form */}
            {showUserForm && (
              <div className="user-form-modal">
                <div className="user-form">
                  <h3>Add New User</h3>
                  <form onSubmit={handleCreateUser}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Username *</label>
                        <input
                          type="text"
                          value={newUser.username}
                          onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                          required
                          className="form-input"
                          placeholder="Enter username"
                        />
                      </div>
                      <div className="form-group">
                        <label>Password *</label>
                        <input
                          type="text"
                          value={newUser.password}
                          onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                          required
                          className="form-input"
                          placeholder="Enter password"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Full Name *</label>
                        <input
                          type="text"
                          value={newUser.name}
                          onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                          required
                          className="form-input"
                          placeholder="Enter full name"
                        />
                      </div>
                      <div className="form-group">
                        <label>Email *</label>
                        <input
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                          required
                          className="form-input"
                          placeholder="Enter email address"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Role *</label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                          required
                          className="form-select"
                        >
                          <option value="student">Student</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>
                          {newUser.role === 'student' ? 'Student ID *' : 'Student ID'}
                        </label>
                        <div className="student-id-container">
                          <input
                            type="text"
                            value={newUser.studentId}
                            onChange={(e) => setNewUser({...newUser, studentId: e.target.value})}
                            required={newUser.role === 'student'}
                            disabled={newUser.role !== 'student'}
                            className="form-input"
                            placeholder="Auto-generated as 23BCSXXXX"
                          />
                          {newUser.role === 'student' && (
                            <button 
                              type="button"
                              onClick={generateStudentId}
                              className="generate-id-btn"
                            >
                              🔄 Generate
                            </button>
                          )}
                        </div>
                        {newUser.role === 'student' && (
                          <small className="form-help">
                            Student ID will be auto-generated in 23BCS format
                          </small>
                        )}
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="save-btn">💾 Create User</button>
                      <button 
                        type="button" 
                        onClick={() => setShowUserForm(false)}
                        className="cancel-btn"
                      >
                        ❌ Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Edit User Form */}
            {editingUser && (
              <div className="user-form-modal">
                <div className="user-form">
                  <h3>Edit User</h3>
                  <form onSubmit={handleUpdateUser}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Username *</label>
                        <input
                          type="text"
                          value={editingUser.username}
                          onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                          required
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Password</label>
                        <input
                          type="text"
                          placeholder="Leave empty to keep current"
                          value={editingUser.password || ''}
                          onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Full Name *</label>
                        <input
                          type="text"
                          value={editingUser.name}
                          onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                          required
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Email *</label>
                        <input
                          type="email"
                          value={editingUser.email}
                          onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                          required
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Role *</label>
                        <select
                          value={editingUser.role}
                          onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                          required
                          className="form-select"
                        >
                          <option value="student">Student</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>
                          {editingUser.role === 'student' ? 'Student ID *' : 'Student ID'}
                        </label>
                        <input
                          type="text"
                          value={editingUser.studentId || ''}
                          onChange={(e) => setEditingUser({...editingUser, studentId: e.target.value})}
                          required={editingUser.role === 'student'}
                          className="form-input"
                          placeholder="23BCSXXXX"
                        />
                        {editingUser.role === 'student' && (
                          <small className="form-help">
                            Format: 23BCS followed by 4 digits (e.g., 23BCS1001)
                          </small>
                        )}
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="save-btn">💾 Update User</button>
                      <button 
                        type="button" 
                        onClick={() => setEditingUser(null)}
                        className="cancel-btn"
                      >
                        ❌ Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Admin Users Section */}
            <div className="role-section admin-section">
              <div className="role-header">
                <div className="role-title">
                  👑 Administrators
                  <span className="role-count">
                    {getUsersByRole('admin').length} Admin{getUsersByRole('admin').length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="users-table-container">
                {getUsersByRole('admin').length === 0 ? (
                  <div className="no-users-message">
                    No administrators found
                  </div>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>User ID</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getUsersByRole('admin').map(userItem => (
                        <tr key={userItem._id} className="table-row">
                          <td className="table-cell">
                            <strong>{userItem.name}</strong>
                          </td>
                          <td className="table-cell">{userItem.username}</td>
                          <td className="table-cell">{userItem.email}</td>
                          <td className="table-cell">
                            <small>{userItem._id}</small>
                          </td>
                          <td className="table-cell">
                            <div className="table-actions">
                              <button 
                                onClick={() => setEditingUser(userItem)}
                                className="edit-btn"
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(userItem._id)}
                                className="delete-btn"
                                disabled={userItem.username === 'admin'}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Staff Users Section */}
            <div className="role-section staff-section">
              <div className="role-header">
                <div className="role-title">
                  👨‍🏫 Staff Members
                  <span className="role-count">
                    {getUsersByRole('staff').length} Staff{getUsersByRole('staff').length !== 1 ? '' : ''}
                  </span>
                </div>
              </div>
              <div className="users-table-container">
                {getUsersByRole('staff').length === 0 ? (
                  <div className="no-users-message">
                    No staff members found
                  </div>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>User ID</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getUsersByRole('staff').map(userItem => (
                        <tr key={userItem._id} className="table-row">
                          <td className="table-cell">
                            <strong>{userItem.name}</strong>
                          </td>
                          <td className="table-cell">{userItem.username}</td>
                          <td className="table-cell">{userItem.email}</td>
                          <td className="table-cell">
                            <small>{userItem._id}</small>
                          </td>
                          <td className="table-cell">
                            <div className="table-actions">
                              <button 
                                onClick={() => setEditingUser(userItem)}
                                className="edit-btn"
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(userItem._id)}
                                className="delete-btn"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Student Users Section */}
            <div className="role-section student-section">
              <div className="role-header">
                <div className="role-title">
                  🎓 Students
                  <span className="role-count">
                    {getUsersByRole('student').length} Student{getUsersByRole('student').length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="users-table-container">
                {getUsersByRole('student').length === 0 ? (
                  <div className="no-users-message">
                    No students found
                  </div>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Student ID</th>
                        <th>User ID</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getUsersByRole('student').map(userItem => (
                        <tr key={userItem._id} className="table-row">
                          <td className="table-cell">
                            <strong>{userItem.name}</strong>
                          </td>
                          <td className="table-cell">{userItem.username}</td>
                          <td className="table-cell">{userItem.email}</td>
                          <td className="table-cell">
                            <strong>{userItem.studentId}</strong>
                          </td>
                          <td className="table-cell">
                            <small>{userItem._id}</small>
                          </td>
                          <td className="table-cell">
                            <div className="table-actions">
                              <button 
                                onClick={() => setEditingUser(userItem)}
                                className="edit-btn"
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(userItem._id)}
                                className="delete-btn"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tab-content">
            <h2>📋 All System Tasks</h2>
            <div className="tasks-table-container">
              {tasks.length === 0 ? (
                <div className="no-tasks">
                  <p>No tasks found</p>
                </div>
              ) : (
                <table className="tasks-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Assigned To</th>
                      <th>Assigned By</th>
                      <th>Status</th>
                      <th>Due Date</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => (
                      <tr key={task._id} className="table-row">
                        <td className="table-cell">
                          <strong>{task.title}</strong>
                        </td>
                        <td className="table-cell">{task.assignedTo}</td>
                        <td className="table-cell">{task.assignedBy}</td>
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
        )}

        {activeTab === 'stats' && (
          <div className="tab-content">
            <h2>📊 System Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Users</h3>
                <p className="stat-number">{users.length}</p>
              </div>
              <div className="stat-card">
                <h3>Admins</h3>
                <p className="stat-number">{users.filter(u => u.role === 'admin').length}</p>
              </div>
              <div className="stat-card">
                <h3>Staff</h3>
                <p className="stat-number">{users.filter(u => u.role === 'staff').length}</p>
              </div>
              <div className="stat-card">
                <h3>Students</h3>
                <p className="stat-number">{users.filter(u => u.role === 'student').length}</p>
              </div>
              <div className="stat-card">
                <h3>Total Tasks</h3>
                <p className="stat-number">{tasks.length}</p>
              </div>
              <div className="stat-card">
                <h3>Pending Tasks</h3>
                <p className="stat-number">{tasks.filter(t => t.status === 'pending').length}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;