import { LifeGridSimBase } from './LifeGridSimBase';
import { LifeGridSimClassic } from './LifeGridSimClassic';
import { LifeGridSimColony } from './LifeGridSimColony';

export class LifeGridSim extends LifeGridSimBase {
  step() {
    if (this.gameMode === 'Colony') {
      LifeGridSimColony.prototype.stepColony.call(this);
      return;
    }

    LifeGridSimClassic.prototype.stepClassic.call(this);
  }
}
