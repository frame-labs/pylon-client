import { jest } from '@jest/globals'
import type Connection from '../src/connection/index.js'
import { AssetType } from '../src/assetId.js'

jest.unstable_mockModule('../src/connection/index.js', () => ({
  default: () => connection
}))

const connection: jest.Mocked<ReturnType<typeof Connection>> = {
  send: jest.fn(),
  request: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  connect: jest.fn(),
  close: jest.fn()
}

const { default: Pylon } = await import('../src/index.js')

it('subscribes to activity', async () => {
  const client = Pylon('ws://test')

  client.activity(['0x1234'])

  expect(connection.send).toHaveBeenCalledWith('subscribeActivity', ['0x1234'])
})

it('subscribes to activity for an additional account', () => {
  const client = Pylon('ws://test')

  client.activity(['0x5678'])
  client.activity(['0x1234', '0x5678'])

  expect(connection.send).toHaveBeenCalledTimes(2)
  expect(connection.send).toHaveBeenNthCalledWith(1, 'subscribeActivity', [
    '0x5678'
  ])

  expect(connection.send).toHaveBeenNthCalledWith(2, 'subscribeActivity', [
    '0x1234'
  ])
})

it('unsubscribes from activity', () => {
  const client = Pylon('ws://test')

  client.activity(['0x1234', '0x5678'])
  client.activity(['0x5678'])

  expect(connection.send).toHaveBeenCalledTimes(2)
  expect(connection.send).toHaveBeenNthCalledWith(1, 'subscribeActivity', [
    '0x1234',
    '0x5678'
  ])

  expect(connection.send).toHaveBeenNthCalledWith(2, 'unsubscribeActivity', [
    '0x1234'
  ])
})

it('subscribes to tokens', async () => {
  const client = Pylon('ws://test')
  client.tokens([
    {
      type: AssetType.Token,
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      chainId: 1
    }
  ])

  expect(connection.send).toHaveBeenCalledWith('subscribeTokens', [
    'eip155:1/erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F'
  ])
})

it('simulates a transaction', async () => {
  const client = Pylon('ws://test')

  const tx = {
    from: '0x1234',
    to: '0x5678',
    value: '0xabc',
    gas: '0xdef'
  }

  connection.request.mockResolvedValueOnce({
    success: true,
    metadata: '0xtest'
  })

  const result = await client.simulate(tx)

  expect(result).toStrictEqual({
    success: true,
    metadata: '0xtest'
  })

  expect(connection.request).toHaveBeenCalledWith('simulateTransaction', tx)
})
