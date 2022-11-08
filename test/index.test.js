import Pylon, { AssetType } from '../'
import { EventEmitter } from 'events'
import { WebSocket } from 'isomorphic-ws'

jest.mock('isomorphic-ws')

let pylon
let id = 1

beforeAll(() => {
  jest.useFakeTimers()

  WebSocket.mockImplementation(function () {
    const e = new EventEmitter()
    this.id = id++
    this.emit = e.emit.bind(e)
    this.on = e.on.bind(e)
    this.addEventListener = e.addListener.bind(e)
    this.removeEventListener = e.removeListener.bind(e)
    this.listenerCount = e.listenerCount.bind(e)
    this.readyState = 1

    return this
  })
})

beforeEach(() => {
  pylon = new Pylon('wss://data.pylon.link')
})

afterEach(() => {
  pylon.close()
})

describe('Database Setup', () => {
  it.skip('Connects', (done) => {
    const pylon = new Pylon('ws://127.0.0.1:9000', { reconnect: false })
    pylon.on('connection', () => {
      pylon.disconnect()
      pylon.on('close', () => {
        done()
      })
    })
  }, 1000)
})

it('handles reconnecting when the network is not available', () => {
  // fire close event from first socket, removing all listeners
  WebSocket.mock.instances[0].emit('error', new Error('could not connect!'))
  WebSocket.mock.instances[0].emit('close')

  jest.advanceTimersByTime(5000)

  // fire error event from second socket, which now has no listeners
  WebSocket.mock.instances[1].emit('open')

  expect(pylon.connected).toBe(true)
})

describe('subscriptions', () => {
  it('subscribes to inventories', () => {
    pylon.inventories([
      '0xd3c89cac4a4283edba6927e2910fd1ebc14fe006'
    ])

    const ws = WebSocket.mock.instances[0]
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
      method: 'inventories', params: [['0xd3c89cac4a4283edba6927e2910fd1ebc14fe006']]
    }))
  })

  it('subscribes to rates', () => {
    pylon.rates([
      { chainId: 1, type: AssetType.NativeCurrency },
      { chainId: 1, type: AssetType.Token, address: '0xd3c89cac4a4283edba6927e2910fd1ebc14fe006' },
      { chainId: 137, type: AssetType.NativeCurrency }
    ])

    const ws = WebSocket.mock.instances[0]

    expect(ws.send).toHaveBeenCalledTimes(1)
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
      method: 'rates', params: [
        [
          'eip155:1/slip44:60',
          'eip155:1/erc20:0xd3c89cac4a4283edba6927e2910fd1ebc14fe006',
          'eip155:137/slip44:60'
        ]
      ]
    }))
  })

  it('subscribes to chains', () => {
    pylon.chains([1, 137, 1])

    const ws = WebSocket.mock.instances[0]

    expect(ws.send).toHaveBeenCalledTimes(1)
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
      // any duplicate chainIds should be removed
      method: 'chains', params: [ ['1', '137'] ]
    }))
  })

  it('stores subscriptions on reconnect', () => {
    pylon.inventories([
      '0xd3c89cac4a4283edba6927e2910fd1ebc14fe006'
    ])

    const ws = WebSocket.mock.instances[0]
    ws.send.mockClear()
    ws.emit('open')
    expect(ws.send).toHaveBeenCalledTimes(2)
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
      method: 'pong', params: []
    }))
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
      method: 'inventories', params: [['0xd3c89cac4a4283edba6927e2910fd1ebc14fe006']]
    }))
  })
})
