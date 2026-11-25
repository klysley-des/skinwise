# SkinWise – Smart Skincare Catalogue and Ingredient Guide

## Project Overview

SkinWise is a web application designed to help users explore skincare products, search product information and understand skincare ingredients.

The application integrates with the Open Beauty Facts API to retrieve product information and presents the data through an interactive user interface.

## Key Features

- Search and explore skincare products.
- Retrieve product information using an external REST API.
- View product details and ingredient information.
- Interactive product catalogue.
- API error handling and loading states.
- Server health monitoring.
- Responsive user interface.

## Technology Stack

- **Frontend:** HTML, CSS and JavaScript.
- **Backend:** Node.js and Express.
- **External API:** Open Beauty Facts.
- **Containerization:** Docker.
- **Load Balancing:** HAProxy.
- **Testing:** Automated application tests using npm.

## Deployment Architecture

SkinWise is deployed on the existing ALU server infrastructure.

| Server | Public IP | Role |
|---|---|---|
| 7325-web-01 | 35.176.105.214 | Docker application server 01 |
| 7325-web-02 | 35.178.109.0 | Docker application server 02 |
| 7325-lb-01 | 13.135.247.58 | HAProxy load balancer |

### Architecture Flow

Users access SkinWise through the HAProxy load balancer on port 8080.

HAProxy distributes incoming requests between two Docker application containers using round-robin load balancing.

- Web01: Host port 3001 → Container port 3000.
- Web02: Host port 3001 → Container port 3000.
- Load balancer: Port 8080.

### Load Balancing

HAProxy uses the `roundrobin` algorithm to distribute incoming requests between Web01 and Web02.

The `/api/health` endpoint is configured as the backend health check.

Each server identifies itself through the health response, allowing the distribution of requests to be demonstrated.

## Public Deployment

**Application:**

http://13.135.247.58:8080

**Health Check:**

http://13.135.247.58:8080/api/health

## Docker Deployment

Both application servers run the same Docker image:

`skinwise:latest`

The containers use the following configuration:

- Container port: 3000
- Host port: 3001
- Automatic restart: `unless-stopped`

The server identifier is configured through the `SERVER_ID` environment variable.

## Testing

Application tests:

```bash
npm test
```

Local health check:

```bash
curl http://localhost:3001/api/health
```

Load balancing verification on the load balancer:

```bash
for i in {1..6}; do
  curl -s http://127.0.0.1:8080/api/health
  echo
done
```

Successful verification should show responses from both Web01 and Web02.

## Deployment Status

SkinWise has been successfully deployed using Docker on both ALU application servers.

HAProxy is configured to distribute traffic between the two Docker containers.

The deployment has been verified through successful health checks and repeated round-robin requests.

## API Attribution

SkinWise uses the Open Beauty Facts API to retrieve product information.

API documentation: https://world.openbeautyfacts.org/data

## Project Structure

```text
skinwise/
├── public/
├── src/
├── test/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── server.js
├── README.md
└── DEPLOY.txt
```