import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Unit } from './Unit';
import { Repeater } from './Repeater';

@Entity('unit_repeaters')
export class UnitRepeater {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  unitId: string;

  @ManyToOne(() => Unit, unit => unit.unitRepeaters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @Column()
  repeaterId: string;

  @ManyToOne(() => Repeater, repeater => repeater.unitRepeaters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repeaterId' })
  repeater: Repeater;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'json', nullable: true })
  config: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
