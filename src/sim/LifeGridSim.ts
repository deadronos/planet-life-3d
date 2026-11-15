import { LifeGridSimBase } from './LifeGridSimBase';
import { stepClassicGrid } from './LifeGridSimClassic';
import { stepColonyGrid } from './LifeGridSimColony';

export class LifeGridSim extends LifeGridSimBase {
  step() {
    this.runStep(this.gameMode === 'Colony' ? stepColonyGrid : stepClassicGrid);
  }
}
