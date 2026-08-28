import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { hashPassword } from '../config/auth.js'
import { AdminUser, Business } from '../models/index.js'

const MIN_PASSWORD_LENGTH = 12
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateSetupInput({ businessName, email, password, passwordConfirmation }) {
  if (typeof businessName !== 'string' || businessName.trim().length < 2 || businessName.trim().length > 120) {
    return 'Business name must be between 2 and 120 characters.'
  }
  if (typeof email !== 'string' || !emailPattern.test(email.trim())) {
    return 'Enter a valid admin email address.'
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password !== passwordConfirmation) {
    return 'Passwords do not match.'
  }
  return null
}

export async function createInitialAdmin({ businessName, email, password }) {
  const normalizedEmail = email.trim().toLowerCase()
  const existingAdmin = await AdminUser.exists({})
  if (existingAdmin) {
    const error = new Error('Initial setup has already been completed; an admin account already exists.')
    error.code = 'ADMIN_ALREADY_EXISTS'
    throw error
  }

  const business = await Business.create({ name: businessName.trim() })
  try {
    const admin = await AdminUser.create({
      businessId: business._id,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      status: 'active',
    })
    return { businessId: business._id.toString(), adminId: admin._id.toString(), email: admin.email }
  } catch (error) {
    await Business.deleteOne({ _id: business._id })
    throw error
  }
}

function questionInterface(input, output) {
  return createInterface({ input, output })
}

async function askHidden(question, input, output) {
  if (!input.isTTY || !input.setRawMode) {
    const prompts = questionInterface(input, output)
    try {
      return await prompts.question(question)
    } finally {
      prompts.close()
    }
  }

  output.write(question)
  return new Promise((resolve) => {
    let answer = ''
    const onData = (chunk) => {
      const character = chunk.toString()
      if (character === '\n' || character === '\r' || character === '\u0004') {
        input.setRawMode(false)
        input.pause()
        input.removeListener('data', onData)
        output.write('\n')
        resolve(answer)
      } else if (character === '\u0003') {
        input.setRawMode(false)
        process.exitCode = 130
        resolve('')
      } else if (character === '\u007f') {
        answer = answer.slice(0, -1)
      } else {
        answer += character
      }
    }
    input.setRawMode(true)
    input.resume()
    input.on('data', onData)
  })
}

export async function runSetup({ input = process.stdin, output = process.stdout } = {}) {
  const prompts = questionInterface(input, output)
  const businessName = await prompts.question('Business name: ')
  const email = await prompts.question('Admin email: ')
  let password
  let passwordConfirmation
  if (input.isTTY && input.setRawMode) {
    prompts.close()
    password = await askHidden('Admin password: ', input, output)
    passwordConfirmation = await askHidden('Confirm password: ', input, output)
  } else {
    password = await prompts.question('Admin password: ')
    passwordConfirmation = await prompts.question('Confirm password: ')
    prompts.close()
  }

  const validationError = validateSetupInput({ businessName, email, password, passwordConfirmation })
  if (validationError) throw new Error(validationError)

  return createInitialAdmin({ businessName, email, password })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await connectDatabase()
    const result = await runSetup()
    console.log(`Initial business and admin created for ${result.email}.`)
    await disconnectDatabase()
  } catch (error) {
    console.error(`Setup failed: ${error.message}`)
    await disconnectDatabase()
    process.exitCode = 1
  }
}
