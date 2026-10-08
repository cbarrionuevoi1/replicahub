import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  rawMessageId: string | null;

  @Column({ type: 'uuid', nullable: true })
  unitId: string;

  @Column()
  imei: string;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;

  @Column({ type: 'float', nullable: true })
  speed: number;

  @Column({ type: 'float', nullable: true })
  heading: number;

  @Column({ type: 'float', nullable: true })
  altitude: number;

  @Column({ type: 'int', nullable: true })
  satellites: number;

  @Column({ type: 'float', nullable: true })
  accuracy: number;

  @Column({ type: 'timestamp' })
  eventTime: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  receivedAt: Date;

  @Column({ type: 'json', nullable: true })
  rawData: any;
}
