import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Unit } from './Unit';
import { Repeater } from './Repeater';

@Entity('unit_repeaters')
export class UnitRepeater {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, unit => unit.unitRepeaters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @Column({ type: 'uuid' })
  repeaterId: string;

  @ManyToOne(() => Repeater, repeater => repeater.unitRepeaters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repeaterId' })
  repeater: Repeater;

  // La tabla creada por InitialSchema utiliza la columna 'active'.
  @Column({ name: 'active', default: true })
  enabled: boolean;

  @Column({ type: 'json', nullable: true })
  config: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
