const { Namespace } = require('@azure/service-bus');
const moment = require('moment');
const delay = require('delay');

const _payload = Buffer.alloc(1024);
const _start = moment();

let _messages = 0;

async function main() {
  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  const entityPath = process.env.SERVICE_BUS_QUEUE_NAME;

  const maxInflight = process.argv.length > 2 ? parseInt(process.argv[2]) : 1;
  const messages = process.argv.length > 3 ? parseInt(process.argv[3]) : 10;
  log(`Maximum inflight messages: ${maxInflight}`);
  log(`Total messages: ${messages}`);

  let writeResultsPromise = WriteResults(messages);
  
  await RunTest(connectionString, entityPath, maxInflight, messages);

  await writeResultsPromise;
};

async function RunTest(connectionString: string, entityPath: string, maxInflight: number, messages: number) {
  const ns = Namespace.createFromConnectionString(connectionString);

  // If using Topics, use createTopicClient to send to a topic
  const client = ns.createQueueClient(entityPath);
  const sender = client.getSender();

  let promises: Promise<void>[] = [];

  for (let i = 0; i < maxInflight; i++ ) {
    let promise = ExecuteSendsAsync(sender, messages);
    promises[i] = promise;
  }

  await Promise.all(promises);

  await client.close();
  await ns.close();
}

async function ExecuteSendsAsync(sender: any, messages: number) {
  while (++_messages <= messages) {
    await sender.send({ body: _payload });
  }

  // Undo last increment, since a message was never sent on the final loop iteration
  _messages--;
}

async function WriteResults(messages: number): Promise<void> {
  let lastMessages = 0;
  let lastElapsed = Number.MAX_SAFE_INTEGER;
  let maxMessages = 0;
  let maxElapsed = Number.MAX_SAFE_INTEGER;

  do {
    await delay(1000);

    let sentMessages = _messages;
    let currentMessages = sentMessages - lastMessages;
    lastMessages = sentMessages;

    let elapsed = moment().diff(_start);
    let currentElapsed = elapsed - lastElapsed;
    lastElapsed = elapsed;

    if ((currentMessages / currentElapsed) > (maxMessages / maxElapsed)) {
      maxMessages = currentMessages;
      maxElapsed = currentElapsed;
    }

    WriteResult(sentMessages, elapsed, currentMessages, currentElapsed, maxMessages, maxElapsed);
  }
  while (_messages < messages);
}

function WriteResult(totalMessages: number, totalElapsed: number,
  currentMessages: number, currentElapsed: number,
  maxMessages: number, maxElapsed: number) {
  log(`\tTot Msg\t${totalMessages}` +
      `\tCur MPS\t${Math.round(currentMessages/ currentElapsed * 1000)}` +
      `\tAvg MPS\t${Math.round(totalMessages / totalElapsed * 1000)}` +
      `\tMax MPS\t${Math.round(maxMessages / totalElapsed * 1000)}`
      );
}

function log(message: string) {
  console.log(`[${moment().format('hh:mm:ss.SSS')}] ${message}`);
}

main().catch(err => {
  log(`Error occurred: ${err}`);
});
