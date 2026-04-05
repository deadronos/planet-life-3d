import * as THREE from 'three';

import { ImpactRing } from '../ImpactRing';
import type { ImpactSpec } from '../impactTypes';
import { Meteor } from '../Meteor';
import type { MeteorSpec } from '../meteorTypes';

export interface MeteorEffectsProps {
  meteors: MeteorSpec[];
  impacts: ImpactSpec[];
  planetRadius: number;
  onMeteorImpact: (id: string, impactPoint: THREE.Vector3) => void;
}

export function MeteorEffects({
  meteors,
  impacts,
  planetRadius,
  onMeteorImpact,
}: MeteorEffectsProps) {
  return (
    <>
      {meteors.map((m) => (
        <Meteor key={m.id} spec={m} planetRadius={planetRadius} onImpact={onMeteorImpact} />
      ))}
      {impacts.map((i) => (
        <ImpactRing key={i.id} spec={i} planetRadius={planetRadius} />
      ))}
    </>
  );
}
