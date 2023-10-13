import { WebSocket, WebSocketServer } from 'ws'

import createConnection from '../../src/connection/index.js'

const port = 21089

let server: ReturnType<typeof createServer>,
  connection: ReturnType<typeof createConnection>

beforeAll(() => {
  server = createServer(port)
  connection = createConnection(`ws://localhost:${port}`)
})

beforeEach((done) => {
  connection.once('connect', async () => {
    // wait for initial heartbeat
    const { event } = await server.waitForMessageFromClient()
    expect(event).toBe('pong')
    done()
  })

  connection.connect()
})

afterEach((done) => {
  connection.once('close', done)
  connection.close()
})

afterAll((done) => {
  server.close(() => done())
})

it('responds to a server heartbeat', async () => {
  server.sendMessageToClient('ping')

  const { event } = await server.waitForMessageFromClient()

  expect(event).toEqual('pong')
})

it('sends an rpc message', async () => {
  connection.send('subscribeActivity', ['0x1234'])

  const { event, payload } = await server.waitForMessageFromClient()

  expect(event).toBe('request')
  expect(payload).toStrictEqual({
    id: 0,
    method: 'subscribeActivity',
    params: ['0x1234']
  })
})

it('sends a synchronous request', async () => {
  const result = connection.request('simulateTransaction', {
    from: '0x1234',
    to: '0x5678',
    value: '0xabc',
    gas: '0xdef'
  })

  const { event, payload } = await server.waitForMessageFromClient()

  expect(event).toBe('request')
  expect(payload).toStrictEqual({
    id: 1,
    method: 'simulateTransaction',
    params: expect.anything()
  })

  server.sendMessageToClient('response', {
    id: 1,
    result: { success: true, metadata: '0xtest' }
  })

  return expect(result).resolves.toStrictEqual({
    success: true,
    metadata: '0xtest'
  })
})

// helpers

function createServer(port: number) {
  const wss = new WebSocketServer({ port })
  let socket: WebSocket

  wss.on('connection', (ws) => {
    socket = ws
  })

  function sendMessageToClient(event: string, payload?: any) {
    const body = payload ? [event, payload] : [event]
    socket.send(JSON.stringify(body))
  }

  async function waitForMessageFromClient() {
    return new Promise<{ event: string; payload: any }>((resolve) => {
      socket.once('message', (message) => {
        const [event, payload] = JSON.parse(message.toString())
        resolve({ event, payload })
      })
    })
  }

  return {
    sendMessageToClient,
    waitForMessageFromClient,
    close: wss.close.bind(wss)
  }
}
