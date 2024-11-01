import { PrismaClient } from '@prisma/client'
import dayjs from 'dayjs'
import { EtfTickers } from '../enums'
import { FarsideRawData } from '../interfaces'
import numeral from 'numeral'
import { promises as fs } from 'fs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
const prisma = new PrismaClient()

/**
 * helpers
 */

const enrichFarsideJson = (rawData: FarsideRawData[]) => {
    const tickers: (EtfTickers | string)[] = []
    const parsedData = rawData
        .filter((day) => dayjs(day.Date).isValid())
        .map((day) => {
            let Total = 0
            const dup = { ...day }
            const entries = Object.entries(dup)
            for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
                const key = entries[entryIndex][0] as keyof typeof dup
                const value = entries[entryIndex][1]
                if (key === 'Date' || dayjs(key).isValid()) continue
                if (key === 'Total') continue
                if (!tickers.includes(key)) tickers.push(key)
                else if (value === '-') dup[key] = 0
                else {
                    const sign = String(value).includes('(') || String(value).includes(')') ? -1 : 1
                    const parsedValue = numeral(String(value).replaceAll('(', '').replaceAll(')', '')).multiply(sign).value()
                    if (parsedValue === null || isNaN(parsedValue)) continue
                    dup[key] = parsedValue
                    Total += parsedValue
                }
            }
            dup.Total = Total
            return dup
        })
    return { tickers, parsedData }
}

/**
 * logic
 */

async function main() {
    // load and parse json
    const path = process.cwd() + '/src/data/farside-btc.json'
    const file = await fs.readFile(path, 'utf8')
    const rawData = JSON.parse(file) as FarsideRawData[]
    const { parsedData } = enrichFarsideJson(rawData)

    // loop over each day
    const cleanFlow = (rawFlow: string | number | undefined) => (isNaN(Number(rawFlow)) ? 0 : Number(rawFlow))
    for (let dayIndex = 0; dayIndex < parsedData.length; dayIndex++) {
        const day = dayjs(parsedData[dayIndex].Date).format('ddd DD MMM YYYY')
        const xata_id = `${day}`.toLowerCase().replaceAll(' ', '-')
        const close_of_bussiness_hour = dayjs.utc(parsedData[dayIndex].Date).hour(17).toDate()
        console.log(`upsert ${xata_id}...`)
        await prisma.flows.upsert({
            where: { xata_id },
            update: {
                day,
                close_of_bussiness_hour,
                IBIT: cleanFlow(parsedData[dayIndex].IBIT),
                FBTC: cleanFlow(parsedData[dayIndex].FBTC),
                BITB: cleanFlow(parsedData[dayIndex].BITB),
                ARKB: cleanFlow(parsedData[dayIndex].ARKB),
                BTCO: cleanFlow(parsedData[dayIndex].BTCO),
                EZBC: cleanFlow(parsedData[dayIndex].EZBC),
                BRRR: cleanFlow(parsedData[dayIndex].BRRR),
                HODL: cleanFlow(parsedData[dayIndex].HODL),
                BTCW: cleanFlow(parsedData[dayIndex].BTCW),
                GBTC: cleanFlow(parsedData[dayIndex].GBTC),
                BTC: cleanFlow(parsedData[dayIndex].BTC),
                total: cleanFlow(parsedData[dayIndex].Total),
                raw: parsedData[dayIndex],
            },
            create: {
                xata_id,
                day,
                close_of_bussiness_hour,
                IBIT: cleanFlow(parsedData[dayIndex].IBIT),
                FBTC: cleanFlow(parsedData[dayIndex].FBTC),
                BITB: cleanFlow(parsedData[dayIndex].BITB),
                ARKB: cleanFlow(parsedData[dayIndex].ARKB),
                BTCO: cleanFlow(parsedData[dayIndex].BTCO),
                EZBC: cleanFlow(parsedData[dayIndex].EZBC),
                BRRR: cleanFlow(parsedData[dayIndex].BRRR),
                HODL: cleanFlow(parsedData[dayIndex].HODL),
                BTCW: cleanFlow(parsedData[dayIndex].BTCW),
                GBTC: cleanFlow(parsedData[dayIndex].GBTC),
                BTC: cleanFlow(parsedData[dayIndex].BTC),
                total: cleanFlow(parsedData[dayIndex].Total),
                raw: parsedData[dayIndex],
            },
        })
    }
}

/**
 * run
 */

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })