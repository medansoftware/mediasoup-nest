# Mediasoup Nest

## Overview

This project implements a real-time communication system using Mediasoup and Nest.js. Mediasoup is an advanced WebRTC SFU (Selective Forwarding Unit) designed for high-performance video and audio streaming. Nest.js is a modern Node.js framework that facilitates the creation of efficient, reliable, and scalable server-side applications.

Combining Mediasoup and Nest.js provides a powerful solution for applications involving real-time video conferencing, live streaming, and interactive media.

## Getting Started

Follow these steps to set up and run the application:

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure the Environment**

   Copy the example environment file and adjust the settings:

   ```bash
   cp .env.example .env
   ```

   Open the `.env` file and update the `SERVER_PUBLIC_IP` with the appropriate IP address.

3. **Run the Application**

   Start the application in development mode:

   ```bash
   npm run start:dev
   ```

4. **Access the Application**

   Open your browser and navigate to `http://localhost:3000` to use the application.

## Optional Configuration

To enable HTTPS, you have two options:

1. **Using Nginx or Apache as a Reverse Proxy**

   Configure Nginx or Apache to handle HTTPS and proxy requests to your application. This is a common approach for securing applications and managing SSL/TLS certificates.

   - **Nginx Configuration Example:**

     ```nginx
     server {
         listen 443 ssl;
         server_name yourdomain.com;

         ssl_certificate /path/to/ssl_certificate.pem;
         ssl_certificate_key /path/to/ssl_certificate_key.pem;

         location / {
             proxy_pass http://localhost:3000;
             proxy_set_header Host $host;
             proxy_set_header X-Real-IP $remote_addr;
             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
             proxy_set_header X-Forwarded-Proto $scheme;
         }
     }

     server {
         listen 80;
         server_name yourdomain.com;
         return 301 https://$host$request_uri;
     }
     ```

   - **Apache Configuration Example:**

     ```apache
     <VirtualHost *:443>
         ServerName yourdomain.com
         SSLEngine on
         SSLCertificateFile /path/to/ssl_certificate.pem
         SSLCertificateKeyFile /path/to/ssl_certificate_key.pem

         ProxyRequests Off
         ProxyPass / http://localhost:3000/
         ProxyPassReverse / http://localhost:3000/
     </VirtualHost>

     <VirtualHost *:80>
         ServerName yourdomain.com
         Redirect permanent / https://yourdomain.com/
     </VirtualHost>
     ```

2. **Using HTTPS Directly in Your Application**

   If you prefer to configure HTTPS directly in your application, modify the `.env` file:

   - Set `ENABLE_HTTPS` to `true`.
   - Provide the paths to your SSL key and certificate files using the `SSL_KEY_FILE` and `SSL_CERT_FILE` variables.

   Ensure you have the necessary certificates and keys, and the application is configured to use them.

## Contact

For questions or additional information, please reach out to [medansoftware.com@gmail.com](mailto:medansoftware.com@gmail.com).
