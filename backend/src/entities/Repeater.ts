import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UnitRepeater } from './UnitRepeater';

@Entity('repeaters')
export class Repeater {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  type: string;

  @Column()
  url: string;

  @Column({ default: 'POST' })
  method: string;

  @Column({ default: 5000 })
  timeout: number;

  @Column({ type: 'json', nullable: true })
  headers: Record<string, string>;

  @Column({ type: 'json', nullable: true })
  auth: any;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ type: 'json', nullable: true })
  config: any;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => UnitRepeater, ur => ur.repeater)
  unitRepeaters: UnitRepeater[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
