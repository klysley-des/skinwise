# SkinWise – Smart Skincare Catalogue and Ingredient Guide

## 1. Project Overview

SkinWise is a web application designed to help users explore skincare products, search product information, and understand skincare ingredients.

The application integrates with the **Open Beauty Facts API**, an external REST API that provides product information, including product names, brands, and ingredients.

SkinWise presents this information through an interactive and responsive user interface.

## 2. Key Features

- Search and explore skincare products.
- Retrieve product information using an external REST API.
- View product details and ingredient information.
- Filter and sort product results.
- Interactive product catalogue.
- API error handling and loading states.
- Server health monitoring.
- Responsive user interface.

## 3. Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS and JavaScript |
| Backend | Node.js and Express |
| External API | Open Beauty Facts |
| Web Servers | Ubuntu Linux |
| Load Balancer | HAProxy |
| HTTPS | Let's Encrypt SSL/TLS certificate |
| Testing | Automated tests using npm |

## 4. Deployment Architecture

SkinWise is deployed across the existing ALU server infrastructure.

| Server | Public IP | Role |
|---|---|---|
| 7325-web-01 | 35.176.105.214 | Application server 1 |
| 7325-web-02 | 35.178.109.0 | Application server 2 |
| 7325-lb-01 | 13.135.247.58 | HAProxy load balancer |

### Architecture Flow

Users access SkinWise through the public domain:

**https://skinwise.mackenainteriorstyles.tech**

The request reaches the HAProxy load balancer on port 443. HAProxy terminates the HTTPS connection and distributes application requests between Web01 and Web02.

Both application servers run the same SkinWise application and expose it on port 3001.

### Load Balancing

HAProxy uses the **round-robin** algorithm to distribute incoming requests between the two application servers.

The `/api/health` endpoint is configured as a backend health check. This allows HAProxy to monitor whether the application servers are responding successfully.

The health endpoint also helps verify which server handled a request.

## 5. Public Deployment

**Application URL:**

https://skinwise.mackenainteriorstyles.tech

**Health Check:**

https://skinwise.mackenainteriorstyles.tech/api/health

## 6. HTTPS and Security

HTTPS is configured on the HAProxy load balancer.

A Let's Encrypt SSL/TLS certificate was obtained for:

`skinwise.mackenainteriorstyles.tech`

The certificate and private key are combined for HAProxy use and stored at:

`/etc/haproxy/certs/skinwise.pem`

HAProxy uses this certificate to establish secure HTTPS connections with visitors.

The application is accessed through the HTTPS domain rather than directly through the application servers.

## 7. Testing

### Run Application Tests

From the project directory:

```bash
npm test
```

### Check Application Health

On either application server:

```bash
curl http://localhost:3001/api/health
```

### Verify Load Balancing

On the load balancer, run:

```bash
for i in {1..6}; do
  curl -sk https://127.0.0.1/api/health -H "Host: skinwise.mackenainteriorstyles.tech"
  echo
done
```

Successful verification should show responses from both Web01 and Web02.

### Validate HAProxy Configuration

```bash
sudo haproxy -c -f /etc/haproxy/haproxy.cfg
```

A successful configuration check displays:

`Configuration file is valid`

## 8. Deployment Status

SkinWise has been deployed across two application servers, with HAProxy configured to distribute incoming traffic using round-robin load balancing.

The application is accessible through its public domain over HTTPS.

The deployment includes backend health checks and an SSL/TLS certificate configured on the load balancer.

## 9. API Attribution

SkinWise uses the Open Beauty Facts API to retrieve product information.

API documentation:

https://world.openbeautyfacts.org/data

Open Beauty Facts is acknowledged as the external data provider used by this application.

## 10. Project Structure

```text
skinwise/
├── public/
├── src/
├── test/
├── package.json
├── package-lock.json
├── server.js
├── README.md
└── DEPLOY.txt
```

## 11. Conclusion

SkinWise demonstrates the integration of an external REST API into a web application and its deployment across multiple servers.

The project demonstrates application functionality, server deployment, HAProxy load balancing, backend health monitoring, and HTTPS configuration.