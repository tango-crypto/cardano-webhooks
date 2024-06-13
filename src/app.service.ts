import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {

  onNewEpoch(value: any) {
    console.log('New Epoch:', value);
    
  }

  onNewBlock(value: any) {
    console.log('New Block:', value);
  }

  onNewDelegation(value: any) {
    console.log('New Delegation:', value);
  }

  onNewPayment(value: any) {
    console.log('New Payment:', value);
  }

  onNewTransaction(value: any) {
    console.log('New Transaction:', value);
  }

}
