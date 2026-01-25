import express, {Request, Response} from 'express'
import { logger } from './services/logger';
import { CONFIG } from './config'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())
const port = CONFIG.PORT

app.get('/', (req: Request, res: Response) =>{

    res.json({
        messege: 'Yooooo tapinda tapinda'
    })
})

app.listen(port,()=>{
    logger.info(`Server running on port ${port}`);
})