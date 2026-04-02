#!/bin/bash

# Start Node.js backend in the background
echo "Starting Node.js Backend..."
NODE_PORT=3000 node dist/app.js > node_backend.log 2>&1 &

# Start Gradio frontend in the foreground
echo "Starting Gradio Frontend..."
python3 frontend.py
