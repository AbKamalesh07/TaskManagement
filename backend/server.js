const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Create WebSocket server attached to the same server
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Store active processes by WebSocket
const activeProcesses = new Map();

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('✅ Client connected to WebSocket');
    
    ws.send(JSON.stringify({
        type: 'status',
        message: '🔗 Connected to real-time Java compiler'
    }));

    // Java compilation function for WebSocket - ACTUAL EXECUTION
    function handleJavaCompilation(ws, code) {
        // Create temporary directory for Java files
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const javaFilePath = path.join(tempDir, 'Main.java');
        const classFilePath = path.join(tempDir, 'Main.class');

        // Send compilation started
        ws.send(JSON.stringify({
            type: 'compilation_started',
            message: '🔨 Compiling your Java code...'
        }));

        // Write Java code to file
        fs.writeFile(javaFilePath, code, (writeErr) => {
            if (writeErr) {
                ws.send(JSON.stringify({
                    type: 'error',
                    error: `❌ Failed to create Java file: ${writeErr.message}`
                }));
                return;
            }

            // Compile Java code using javac
            const compileProcess = spawn('javac', [javaFilePath]);

            let compileError = '';
            compileProcess.stderr.on('data', (data) => {
                compileError += data.toString();
            });

            compileProcess.on('close', (compileCode) => {
                if (compileCode !== 0) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: `❌ Compilation failed:\n${compileError}`
                    }));
                    // Clean up
                    cleanupFiles(javaFilePath, classFilePath);
                    return;
                }

                ws.send(JSON.stringify({
                    type: 'compilation_success',
                    message: '✅ Compilation successful'
                }));

                ws.send(JSON.stringify({
                    type: 'execution_started',
                    message: '🚀 Execution started...'
                }));

                // Execute the compiled Java program with proper stdio configuration
                const javaProcess = spawn('java', ['-cp', tempDir, 'Main'], {
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                // Store the process for this WebSocket connection
                activeProcesses.set(ws, { 
                    process: javaProcess, 
                    javaFilePath, 
                    classFilePath
                });

                // Handle program output (stdout)
                javaProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    ws.send(JSON.stringify({
                        type: 'output',
                        output: output
                    }));
                });

                // Handle program errors (stderr)
                javaProcess.stderr.on('data', (data) => {
                    const errorOutput = data.toString();
                    ws.send(JSON.stringify({
                        type: 'output',
                        output: errorOutput
                    }));
                });

                // Handle program completion
                javaProcess.on('close', (exitCode) => {
                    ws.send(JSON.stringify({
                        type: 'program_exit',
                        exitCode: exitCode,
                        message: exitCode === 0 ? '🏁 Program completed successfully' : `🏁 Program exited with code: ${exitCode}`
                    }));
                    
                    // Clean up process and files
                    activeProcesses.delete(ws);
                    cleanupFiles(javaFilePath, classFilePath);
                });

                // Handle process errors
                javaProcess.on('error', (err) => {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: `❌ Execution error: ${err.message}`
                    }));
                    activeProcesses.delete(ws);
                    cleanupFiles(javaFilePath, classFilePath);
                });

                // Set timeout to handle programs that might hang
                const timeout = setTimeout(() => {
                    if (javaProcess && !javaProcess.killed) {
                        javaProcess.kill();
                        ws.send(JSON.stringify({
                            type: 'error',
                            error: '⏰ Program execution timeout (15 seconds)'
                        }));
                    }
                }, 15000);

                javaProcess.on('close', () => {
                    clearTimeout(timeout);
                });
            });

            // Handle compilation errors
            compileProcess.on('error', (err) => {
                ws.send(JSON.stringify({
                    type: 'error',
                    error: `❌ Compilation error: ${err.message}`
                }));
                cleanupFiles(javaFilePath, classFilePath);
            });
        });
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received WebSocket message:', data.type);
            
            // Handle Java compilation requests
            if (data.type === 'compile_and_run') {
                // Kill any existing process for this connection
                const existingProcess = activeProcesses.get(ws);
                if (existingProcess) {
                    existingProcess.process.kill();
                    activeProcesses.delete(ws);
                }
                
                handleJavaCompilation(ws, data.code);
            }
            
            // Handle user input for interactive programs
            if (data.type === 'user_input') {
                const processInfo = activeProcesses.get(ws);
                if (processInfo && processInfo.process && processInfo.process.stdin) {
                    // Send input immediately to the Java process
                    processInfo.process.stdin.write(data.input + '\n');
                    console.log('Input sent to Java process:', data.input);
                } else {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: '❌ No active program to send input to'
                    }));
                }
            }
            
            // Handle stop execution
            if (data.type === 'stop_execution') {
                const processInfo = activeProcesses.get(ws);
                if (processInfo) {
                    processInfo.process.kill();
                    activeProcesses.delete(ws);
                    ws.send(JSON.stringify({
                        type: 'program_exit',
                        exitCode: 0,
                        message: '⏹️ Execution stopped by user'
                    }));
                }
            }
            
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Failed to process request'
            }));
        }
    });

    ws.on('close', () => {
        console.log('❌ Client disconnected from WebSocket');
        // Clean up any active process for this connection
        const processInfo = activeProcesses.get(ws);
        if (processInfo) {
            processInfo.process.kill();
            activeProcesses.delete(ws);
            cleanupFiles(processInfo.javaFilePath, processInfo.classFilePath);
        }
    });
});

// Helper function to clean up temporary files
function cleanupFiles(javaPath, classPath) {
    try {
        if (fs.existsSync(javaPath)) {
            fs.unlinkSync(javaPath);
        }
        if (fs.existsSync(classPath)) {
            fs.unlinkSync(classPath);
        }
    } catch (err) {
        console.log('Cleanup warning:', err.message);
    }
}

// ... REST OF YOUR EXISTING SERVER CODE (MongoDB, Schemas, Routes, etc.) ...
// [Keep all your existing MongoDB connection, schemas, routes exactly as they are]

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/college_management', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ Connected to MongoDB');
    initializeDefaultUsers();
})
.catch(err => console.error('❌ MongoDB connection error:', err));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    studentId: { type: String, default: null }
});

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    instructions: { type: String },
    assignedTo: { type: String, required: true },
    assignedBy: { type: String, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    submission: {
        code: { type: String, default: '' },
        output: { type: String, default: '' },
        submittedAt: { type: Date }
    }
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);

// Initialize default users
async function initializeDefaultUsers() {
    try {
        console.log('🔄 Initializing default users...');
        
        // Define default users with 23BCS student IDs
        const defaultUsers = [
            {
                username: 'admin',
                password: 'pass123',
                email: 'admin@college.edu',
                name: 'System Administrator',
                role: 'admin',
                studentId: null
            },
            {
                username: 'Gayathri',
                password: 'pass123',
                email: 'gayathri@college.edu',
                name: 'Gayathri',
                role: 'staff',
                studentId: null
            },
            {
                username: 'Kannan',
                password: 'pass123',
                email: 'kannan@student.edu',
                name: 'Kannan',
                role: 'student',
                studentId: '23BCS1001'
            },
            {
                username: 'Kamaleeh',
                password: 'pass123',
                email: 'kamaleeh@student.edu',
                name: 'Kamaleeh',
                role: 'student',
                studentId: '23BCS1002'
            },
            {
                username: 'Vishal',
                password: 'pass123',
                email: 'vishal@student.edu',
                name: 'Vishal',
                role: 'student',
                studentId: '23BCS1003'
            },
            {
                username: 'DemoStudent',
                password: 'pass123',
                email: 'demo@student.edu',
                name: 'Demo Student',
                role: 'student',
                studentId: '23BCS1004'
            }
        ];

        let createdCount = 0;
        for (const userData of defaultUsers) {
            try {
                const existingUser = await User.findOne({ username: userData.username });
                if (!existingUser) {
                    await User.create(userData);
                    console.log(`✅ Created user: ${userData.username} (${userData.role})`);
                    createdCount++;
                } else {
                    console.log(`ℹ️  User already exists: ${userData.username}`);
                }
            } catch (userError) {
                console.error(`❌ Error creating user ${userData.username}:`, userError.message);
            }
        }

        console.log(`🎉 User initialization complete. Created/verified ${createdCount} users.`);
        
    } catch (error) {
        console.error('❌ Error during user initialization:', error);
    }
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_2024', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Admin Middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Enhanced Java Compiler API
app.post('/api/compile/java', async (req, res) => {
    try {
        const { code } = req.body;
        
        console.log('🔧 Compiling Java code...');
        
        if (!code || code.trim() === '') {
            return res.json({
                success: false,
                output: '',
                error: 'Error: Please write some Java code first.'
            });
        }

        // Simulate compilation with better code analysis
        setTimeout(() => {
            try {
                // Check for basic Java structure
                if (!code.includes('class')) {
                    return res.json({
                        success: false,
                        output: '',
                        error: 'Error: No class found. Java code must contain a class definition.'
                    });
                }

                if (!code.includes('public static void main')) {
                    return res.json({
                        success: false,
                        output: '',
                        error: 'Error: Main method not found. Please include: public static void main(String[] args)'
                    });
                }

                // Check for common patterns and provide appropriate output
                if (code.includes('System.out.println("Hello World"') || 
                    code.includes("System.out.println('Hello World'") ||
                    code.includes('System.out.println("Hello World!")')) {
                    return res.json({
                        success: true,
                        output: 'Hello World!\nProgram executed successfully! 🎉',
                        error: null
                    });
                }

                if (code.includes('System.out.print(') || code.includes('System.out.println(')) {
                    // Extract and simulate output from print statements
                    const outputLines = [];
                    const lines = code.split('\n');
                    
                    lines.forEach(line => {
                        if (line.includes('System.out.print(') || line.includes('System.out.println(')) {
                            const match = line.match(/System\.out\.print(ln)?\(([^)]+)\)/);
                            if (match) {
                                let content = match[2];
                                // Remove quotes and simulate output
                                content = content.replace(/["']/g, '').trim();
                                if (content.includes('+')) {
                                    // Handle concatenation
                                    content = content.split('+').map(part => part.replace(/["']/g, '').trim()).join(' ');
                                }
                                outputLines.push(content);
                            }
                        }
                    });

                    const output = outputLines.join('\n') + '\nProgram executed successfully! ✅';
                    return res.json({
                        success: true,
                        output: output,
                        error: null
                    });
                }

                // Default success response for valid Java code
                return res.json({
                    success: true,
                    output: 'Code compiled and executed successfully! ✅\n(Note: This is a simulation. In production, actual Java compilation would occur.)',
                    error: null
                });

            } catch (parseError) {
                return res.json({
                    success: false,
                    output: '',
                    error: 'Compilation Error: ' + parseError.message
                });
            }
        }, 1000);

    } catch (error) {
        console.error('❌ Compilation error:', error);
        res.status(500).json({ 
            success: false, 
            output: '', 
            error: 'Server error during compilation: ' + error.message 
        });
    }
});

// Login API
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        console.log(`🔑 Login attempt: ${username}, role: ${role}`);

        // Find user by username and role
        const user = await User.findOne({ username, role });
        
        if (!user) {
            console.log('❌ User not found:', username, 'with role:', role);
            return res.status(400).json({ message: 'User not found. Please check username and role.' });
        }

        console.log('🔍 Found user:', user.username, 'Stored password:', user.password);

        // Direct password comparison
        if (password !== user.password) {
            console.log('❌ Password mismatch. Entered:', password, 'Stored:', user.password);
            return res.status(400).json({ message: 'Invalid password. Please try again.' });
        }

        console.log('✅ Login successful for:', user.username);

        const token = jwt.sign(
            { 
                id: user._id, 
                username: user.username, 
                role: user.role,
                studentId: user.studentId || null,
                name: user.name
            }, 
            process.env.JWT_SECRET || 'fallback_secret_key_2024',
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token, 
            user: { 
                username: user.username, 
                role: user.role,
                name: user.name,
                studentId: user.studentId || null,
                email: user.email
            } 
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// ==================== ADMIN ROUTES ====================

// Get all users (Admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new user (Admin only)
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, password, email, name, role, studentId } = req.body;
        
        const user = new User({
            username,
            password: password || 'pass123',
            email,
            name,
            role,
            studentId: role === 'student' ? studentId : null
        });
        
        await user.save();
        
        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.json({ message: 'User created successfully', user: userResponse });
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ message: 'Username already exists' });
        } else {
            res.status(500).json({ message: error.message });
        }
    }
});

// Update user (Admin only)
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, email, name, role, studentId, password } = req.body;
        const userId = req.params.id;
        
        const updateData = { username, email, name, role };
        
        if (password) {
            updateData.password = password;
        }
        
        if (role === 'student') {
            updateData.studentId = studentId;
        } else {
            updateData.studentId = null;
        }
        
        const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.json({ message: 'User updated successfully', user: userResponse });
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ message: 'Username already exists' });
        } else {
            res.status(500).json({ message: error.message });
        }
    }
});

// Delete user (Admin only)
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all tasks (Admin only)
app.get('/api/admin/tasks', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete task (Admin only)
app.delete('/api/admin/tasks/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await Task.findByIdAndDelete(req.params.id);
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== STAFF ROUTES ====================

// Get all students (for staff)
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }, 'studentId username name email');
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Assign Task (staff)
app.post('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { title, description, instructions, studentId, dueDate } = req.body;
        
        const task = new Task({
            title,
            description,
            instructions,
            assignedTo: studentId,
            assignedBy: req.user.username,
            dueDate: new Date(dueDate)
        });
        
        await task.save();
        
        res.json({ message: 'Task assigned successfully', task });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get tasks for staff
app.get('/api/tasks/staff', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.find({ assignedBy: req.user.username }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete task (staff)
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        await Task.findByIdAndDelete(req.params.id);
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== STUDENT ROUTES ====================

// Get tasks for student
app.get('/api/tasks/student', authenticateToken, async (req, res) => {
    try {
        const student = await User.findOne({ username: req.user.username, role: 'student' });
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        const tasks = await Task.find({ assignedTo: student.studentId }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update task status (student submission)
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const { status, code, output } = req.body;
        const updateData = { status };
        
        if (status === 'submitted') {
            updateData.submission = {
                code: code || '',
                output: output || '',
                submittedAt: new Date()
            };
        }
        
        const task = await Task.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        
        res.json({ message: 'Task updated successfully', task });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== UTILITY ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'College Management System API is running',
        timestamp: new Date().toISOString()
    });
});

// Initialize users endpoint
app.post('/api/init', async (req, res) => {
    try {
        await User.deleteMany({});
        await Task.deleteMany({});
        await initializeDefaultUsers();
        res.json({ message: 'Database initialized successfully with all default users' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Debug endpoint - List all users
app.get('/api/debug/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create admin only endpoint
app.post('/api/create-admin', async (req, res) => {
    try {
        console.log('🛠️ Force creating admin user...');
        
        // Delete existing admin if any
        await User.deleteOne({ username: 'admin', role: 'admin' });
        
        // Create new admin
        const adminUser = await User.create({
            username: 'admin',
            password: 'pass123',
            email: 'admin@college.edu',
            name: 'System Administrator',
            role: 'admin',
            studentId: null
        });
        
        console.log('✅ Admin user created successfully:', adminUser);
        res.json({ 
            success: true, 
            message: 'Admin user created successfully',
            user: {
                username: adminUser.username,
                role: adminUser.role,
                email: adminUser.email
            }
        });
    } catch (error) {
        console.error('❌ Error creating admin:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create admin user: ' + error.message 
        });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 College Management System Backend Started`);
    console.log(`📍 HTTP API: http://localhost:${PORT}/api`);
    console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
    console.log(`🔑 Default password for all users: pass123`);
    console.log(`👤 Admin credentials: admin / pass123`);
    console.log(`💡 Initialize data: POST http://localhost:${PORT}/api/init`);
    console.log(`🛠️  Create admin only: POST http://localhost:${PORT}/api/create-admin`);
    console.log(`☕ Make sure Java is installed for WebSocket compilation`);
});