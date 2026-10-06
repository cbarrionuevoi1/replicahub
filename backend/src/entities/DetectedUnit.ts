import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('detected_units')
export class DetectedUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  imei: string;

  @Column({ type: 'timestamp' })
  firstDetectionAt: Date;

  @Column({ type: 'timestamp' })
  lastDetectionAt: Date;

  @Column({ default: 0 })
  transmissionCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
