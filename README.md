## Deployment on ALU servers

SkinWise is designed to run on the existing ALU infrastructure:

| Server | Public IP | Role |
|---|---|---|
| 7325-web-01 | 35.176.105.214 | Web server 01 |
| 7325-web-02 | 35.178.109.0 | Web server 02 |
| 7325-lb-01 | 13.135.247.58 | HAProxy load balancer |

The intended architecture uses Docker to run SkinWise on Web01 and Web02, with Nginx forwarding requests to the application. HAProxy distributes incoming traffic between both web servers.

**Deployment status:** Local development and application testing have been completed. Deployment to the ALU servers is pending.

The existing Nginx configurations, HAProxy configuration, HTTPS certificate and previous coursework must be preserved. The deployment scripts require adaptation and server configuration backups before execution.

The application has not yet been confirmed as publicly deployed.