FROM node:20-bullseye
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY pwa/package*.json ./pwa/
RUN cd pwa && npm ci
COPY . .
EXPOSE 5173
CMD ["sh", "-c", "cd pwa && npm run dev -- --host 0.0.0.0"]
