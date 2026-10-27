const notifyClients = (clients, data) => {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};

module.exports = { notifyClients };