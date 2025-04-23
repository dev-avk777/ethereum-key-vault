import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm'

@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 42 })
  userAddress: string

  @Column({ type: 'varchar', length: 66 })
  txHash: string

  @Column({ type: 'varchar' })
  amount: string

  @Column({ type: 'varchar', length: 42 })
  toAddress: string

  @CreateDateColumn()
  timestamp: Date
}
