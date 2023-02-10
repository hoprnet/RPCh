# Manager

## Description

Manager is an API which allows you to perform various tasks to the RPCh ecosystem.
It's used by [sandbox](../sandbox/) and our [infrastructure](https://github.com/Rpc-h/infrastructure) to bootstrap the RPCh ecosystem to a working state.

### High level abilities

|                      | sandbox | infrastructure |
| -------------------- | ------- | -------------- |
| fund HOPRd nodes     | Pluto   | Manager        |
| register HOPRd nodes | Pluto   | Manager        |
| open channels        | Pluto   | Manager        |
| fund funding service | Manager | Manager        |
| register exit nodes  | Manager | Manager        |
