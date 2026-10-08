import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Client } from './Client';
import { UnitRepeater } from './UnitRepeater';

@Entity('units')
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Para unidades registradas automáticamente, la placa puede ser nula inicialmente.
  @Column({ unique: true, nullable: true })
  plate: string;

  @Column({ unique: true })
  imei: string;

  @ManyToOne(() => Client, client => client.units, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ type: 'uuid', nullable: true })
  clientId: string;

  @Column({ nullable: true })
  alias: string;

  @Column({ default: 'MANUAL' })
  origin: string; // 'MANUAL' o 'AUTO'

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  firstTransmissionAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastTransmissionAt: Date;

  @OneToMany(() => UnitRepeater, ur => ur.unit)
  unitRepeaters: UnitRepeater[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
