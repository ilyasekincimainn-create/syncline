import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp up to 50 users
    { duration: '1m', target: 50 },  // stay at 50 users
    { duration: '10s', target: 0 },  // ramp down to 0
  ],
};

export default function () {
  const url = 'ws://localhost:3000/ws';
  const params = { tags: { my_tag: 'syncline_load' } };

  const response = ws.connect(url, params, function (socket) {
    socket.on('open', function open() {
      console.log('Connected to WebSocket!');
      
      // Send mock authentication request
      const authMsg = JSON.stringify({
        type: 'auth_request',
        id: `k6_auth_${Math.random()}`,
        timestamp: Date.now(),
        payload: {
          accessToken: 'mocked_jwt_token',
          deviceId: `k6_dev_${__VU}`
        }
      });
      socket.send(authMsg);

      // Periodically send ping
      socket.setInterval(function () {
        const pingMsg = JSON.stringify({
          type: 'ping',
          id: `k6_ping_${Math.random()}`,
          timestamp: Date.now(),
          payload: {}
        });
        socket.send(pingMsg);
      }, 10000); // 10s ping
    });

    socket.on('message', function (message) {
      const parsed = JSON.parse(message);
      check(parsed, {
        'message received is valid': (msg) => msg !== null && msg.type !== undefined,
      });
    });

    socket.on('close', function () {
      console.log('Connection closed');
    });

    socket.on('error', function (e) {
      console.log('An error occurred: ', e.error());
    });

    // Run connection for 20 seconds before disconnecting
    socket.setTimeout(function () {
      socket.close();
    }, 20000);
  });

  check(response, { 'status is 101': (r) => r && r.status === 101 });
}
