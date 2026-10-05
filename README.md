# MERN Chat Application

## Table of Contents
- [Introduction](#introduction)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Deployment Configuration](#deployment-configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Introduction
The MERN Chat Application is a real-time chat platform built using the MERN stack (MongoDB, Express.js, React.js) with additional technologies like WebSocket for real-time communication. This project provides users with a responsive chat experience, user authentication, and private messaging.

## Features
- **Real-Time Messaging**: Instant communication between users using WebSocket.
- **User Authentication**: Login and signup using JWT and bcrypt.
- **Private Chats**: Support for one-on-one private messages.
- **MongoDB Integration**: Storage and retrieval of user data and messages.

## Technologies Used
- **Frontend**: React.js, CSS, Tailwind CSS
- **Backend**: Node.js, Express.js, WebSocket
- **Database**: MongoDB
- **Authentication**: JWT and bcrypt
- **Others**: Axios, dotenv

## Installation

### Prerequisites
- Node.js installed on your machine
- MongoDB instance (local or Atlas)
- Git

### Clone the Repository
```bash
git clone https://github.com/Rishabh2140/mern-chat.git
cd mern-chat
```

## Deployment Configuration

The Render service serves both the API and the built client from one origin. Create one Render Web Service for the repository with the root directory left blank, build command `npm ci --prefix api && npm ci --include=dev --prefix client && npm run build --prefix client`, and start command `node api/index.js`.

Set `NODE_ENV=production`, `MONGO_URL`, a unique `JWT_SECRET` with at least 32 random bytes, and `CLIENT_URL` to the exact HTTPS origin of the Render service. The client defaults its API and WebSocket URLs to the page origin in production. For local development, copy `client/.env.example` to `client/.env`; its `VITE_API_URL` points to the separately running local API.

Never commit `.env` files. Rotate any database credentials previously used in a local environment. Render's free filesystem is temporary, so uploaded files may disappear after restarts or redeploys, and free services may sleep while idle.
