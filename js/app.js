const { Namespace } = require('@azure/service-bus');
const moment = require('moment');

let _payload = new Uint8Array(1024);
let _messages = 0;

async function main() {
  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  const queueName = process.env.SERVICE_BUS_QUEUE_NAME;

  const maxInFlight = process.argv.length > 2 ? process.argv[2] : 1;
  const messages = process.argv.length > 3 ? process.argv[3] : 10;
  log(`Maximum inflight messages: ${maxInFlight}`);
  log(`Total messages: ${messages}`);

  let writeResultsPromise = WriteResults(messages);

  const ns = Namespace.createFromConnectionString(connectionString);

  // If using Topics, use createTopicClient to send to a topic
  const client = ns.createQueueClient(queueName);
  const sender = client.getSender();

  try {
    console.log('sending...');
    await sender.send({ body: 'hello' });
    console.log('sent');

    await client.close();
  } finally {
    await ns.close();
  }
};

function log(message) {
  console.log(`[${moment().format('hh:mm:ss.SSS')}] ${message}`);
}

main().catch(err => {
  console.log('Error occurred: ', err);
});
