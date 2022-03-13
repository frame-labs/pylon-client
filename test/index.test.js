import Pylon from '../'

describe('Database Setup', () => {
  it('Connects', (done) => {
    const pylon = new Pylon('ws://127.0.0.1:9000', { reconnect: false })
    pylon.on('connection', () => {
      pylon.disconnect()
      pylon.on('close', () => {
        done()
      })
    })
  }, 1000)
})
