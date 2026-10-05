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

Copy `api/.env.example` to `api/.env` and configure a new MongoDB connection string, a unique `JWT_SECRET` with at least 32 random bytes, the public HTTPS frontend origin in `CLIENT_URL`, and `NODE_ENV=production`. Copy `client/.env.example` to `client/.env` and set `VITE_API_URL` to the public HTTPS API origin before building the client.

Rotate any database credentials previously used in a local environment. Never commit `.env` files. Deploy the built client and API behind HTTPS; production startup rejects non-HTTPS client origins and uses secure, HTTP-only session cookies.
