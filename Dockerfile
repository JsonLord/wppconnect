FROM node:22

# Install dependencies, Chromium, Python and pip
RUN apt-get update && apt-get install -y \
    chromium \
    python3 \
    python3-pip \
    python3-venv \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    procps libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_PORT=3000

WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.scripts.prepare = ''; pkg.scripts.start = ''; pkg.dependencies.express = '^4.18.2'; pkg.devDependencies['@types/express'] = '^4.17.17'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));"
RUN npm install --legacy-peer-deps

# Install Python dependencies
RUN pip3 install --break-system-packages "gradio>=4.0.0" requests

# Copy all source
COPY . .

# Build Node application
RUN npm run build
RUN chmod +x start.sh

# Expose the Gradio port
EXPOSE 7860

# Use start script
CMD ["/bin/bash", "./start.sh"]
