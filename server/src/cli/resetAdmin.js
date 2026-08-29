import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { hashPassword } from '../config/auth.js'
import { AdminUser } from '../models/index.js'

const MIN_PASSWORD_LENGTH = 12
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateResetInput({ email, password, passwordConfirmation }) {
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

export async function resetAdminPassword({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase()
  let admin = await AdminUser.findOne({ email: normalizedEmail })

  if (!admin) {
    const allAdmins = await AdminUser.find({}).lean()
    if (allAdmins.length === 1) {
      admin = await AdminUser.findById(allAdmins[0]._id)
      console.log(`Notice: Email '${normalizedEmail}' not found. Resetting single existing admin account: '${admin.email}'`)
    } else if (allAdmins.length > 1) {
      const existingEmails = allAdmins.map((a) => a.email).join(', ')
      const error = new Error(`No admin found for '${normalizedEmail}'. Existing admin email(s): ${existingEmails}`)
      error.code = 'ADMIN_NOT_FOUND'
      throw error
    } else {
      const error = new Error(`No admin account found for email: ${normalizedEmail}`)
      error.code = 'ADMIN_NOT_FOUND'
      throw error
    }
  }

  const passwordHash = await hashPassword(password)
  const passwordResetAt = new Date()

  await AdminUser.updateOne(
    { _id: admin._id },
    {
      $set: {
        passwordHash,
        'authMetadata.passwordResetAt': passwordResetAt,
      },
    },
  )

  return {
    adminId: admin._id.toString(),
    email: admin.email,
    businessId: admin.businessId.toString(),
    passwordResetAt,
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

export async function runReset({ input = process.stdin, output = process.stdout } = {}) {
  const prompts = questionInterface(input, output)
  const email = await prompts.question('Existing admin email: ')
  let password
  let passwordConfirmation
  if (input.isTTY && input.setRawMode) {
    prompts.close()
    password = await askHidden('New admin password: ', input, output)
    passwordConfirmation = await askHidden('Confirm new password: ', input, output)
  } else {
    password = await prompts.question('New admin password: ')
    passwordConfirmation = await prompts.question('Confirm new password: ')
    prompts.close()
  }

  const validationError = validateResetInput({ email, password, passwordConfirmation })
  if (validationError) throw new Error(validationError)

  return resetAdminPassword({ email, password })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await connectDatabase()
    const result = await runReset()
    console.log(`Password successfully reset for admin ${result.email}.`)
    await disconnectDatabase()
  } catch (error) {
    console.error(`Password reset failed: ${error.message}`)
    await disconnectDatabase()
    process.exitCode = 1
  }
}
