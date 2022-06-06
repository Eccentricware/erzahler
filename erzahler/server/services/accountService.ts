import { Pool } from 'pg';
import { getUserEmailQuery } from '../../database/queries/accounts/get-user-email-query';
import { getUsernameQuery } from '../../database/queries/accounts/get-username-query';
import { victorCredentials } from '../../secrets/dbCredentials';
import { getAuth, UserRecord } from 'firebase-admin/auth'
import { createUserQuery } from '../../database/queries/accounts/create-user-query';
import { createProviderQuery } from '../../database/queries/accounts/create-provider-query';
import { getUserProfileQuery } from '../../database/queries/dashboard/get-user-profile-query';
import { getUserWithEmailProviderQuery } from '../../database/queries/accounts/get-user-with-email-provider-query';
import { validateUserEmailQuery } from '../../database/queries/accounts/validate-user-email-query';
import { validateProviderEmailQuery } from '../../database/queries/accounts/validate-provider-email-query';

export class AccountService {
  async checkUsernameAvailable(username: string): Promise<any> {
    const pool = new Pool(victorCredentials);

    return pool.query(getUsernameQuery, [username])
      .then((usernameCountResponse: any) => {
        if (usernameCountResponse.rows.length === 0) {
          return true;
        } else {
          return false;
        }
      })
      .catch((error: Error) => console.error(error.message));
  }

  async validateUser(idToken: string): Promise<any> {
    return getAuth()
      .verifyIdToken(idToken, true)
      .then((user: any) => {
        return {
          uid: user.uid,
          valid: true
        };
      })
      .catch((error: Error) => {
        return { valid: false };
      });
  }

  async validateToken(idToken: string): Promise<any> {
    return getAuth()
      .verifyIdToken(idToken, true)
      .then((user: any) => {
        return {
          uid: user.uid,
          valid: true
        };
      })
      .catch((error: Error) => {
        return {
          error: error.message
        }
      });
  }

  async attemptAddUserToDatabase(idToken: string, username: string): Promise<any> {
    const token = await this.validateUser(idToken);
    const usernameAvailable = await this.checkUsernameAvailable(username);

    if (token.valid && usernameAvailable) {
      const firebaseUser = await this.getFirebaseUser(token.uid);
      const addUserResult: any = await this.addUserToDatabase(firebaseUser, username);
      return addUserResult;
    }
  }

  async addUserToDatabase(
    firebaseUser: UserRecord,
    username: string,
  ): Promise<any> {
    if (firebaseUser.providerData[0].providerId === 'password') {
      let verificationDeadline: number = Date.now();
      verificationDeadline += 3600000;

      const emailUserArgs = [
        username,
        false,
        'unverified',
        firebaseUser.email,
        firebaseUser.emailVerified,
        new Date(verificationDeadline),
        firebaseUser.metadata.creationTime,
        firebaseUser.metadata.lastSignInTime,
      ];

      await getAuth()
        .updateUser(firebaseUser.uid, {
          displayName: username
        })
        .then((user: UserRecord) => {
          return { success: true };
        })
        .catch((error: Error) => {
          return {
            success: false,
            error: error.message
          };
        });

      return await this.runAddUserQuery(firebaseUser, username, emailUserArgs);


    } else {
      const oAuthUserArgs = [
        username,
        true,
        'active',
        null,
        null,
        null,
        firebaseUser.metadata.creationTime,
        firebaseUser.metadata.lastSignInTime,
      ];

      return await this.runAddUserQuery(firebaseUser, username, oAuthUserArgs);
    }
  }

  async runAddUserQuery(firebaseUser: UserRecord, username: string, userArgs: any[]): Promise<any> {
    const pool = new Pool(victorCredentials);

    const addUserQueryResultInternal: any = await pool.query(createUserQuery, userArgs)
      .then((response: any) => {
        return this.getUserId(username)
          .then((userId) => {
            return pool.query(
              createProviderQuery,
              [
                userId,
                firebaseUser.uid,
                firebaseUser.providerData[0].providerId,
                firebaseUser.providerData[0].displayName,
                firebaseUser.providerData[0].email,
                firebaseUser.providerData[0].photoURL,
                firebaseUser.metadata.creationTime,
                firebaseUser.metadata.lastSignInTime
              ]
            ).then(() => {
              return { success: true };
            }).catch((error: Error) => {
              console.log('add provider error', error.message);
              return { error: error.message};
            });
          })
          .catch((error: Error) => {
            console.log('Get userId error:', error.message);
            return { error: error.message }
          });
    }).catch((error: Error) => {
      console.log('Add user db error:', error.message);
      return error.message;
    });

    return addUserQueryResultInternal;
  }

  async getUserId(username: string): Promise<any> {
    const pool = new Pool(victorCredentials);

    return pool.query(getUsernameQuery, [username])
      .then((userResult: any) => {
        return userResult.rows[0].user_id;
      })
      .catch((e: Error) => console.error(e.message));
  }

  async getFirebaseUser(uid: string): Promise<any> {
    return getAuth()
      .getUser(uid)
      .then((user: any) => {
        return user;
      })
      .catch((error: Error) => {
        return error.message;
      });
  }

  async getAuthenticatedUser(idToken: string) {
    return this.validateUser(idToken)
      .then((uid: string) => {
        return this.getFirebaseUser(uid);
      })
      .catch((error: Error) => {
        return {
          error: error.message
        }
      });
  }

  async getUserProfile(idToken: string): Promise<any> {
    const token: any = await this.validateToken(idToken);

    if (token.valid) {
      const pool = new Pool(victorCredentials);
      const userProfile: Promise<any> = pool.query(getUserProfileQuery, [token.uid]);

      return userProfile
      .then((profiles: any) => {
        console.log('profiles', profiles.rows);
        return profiles.rows;
      })
      .catch((error: Error) => {
        return { error: error.message };
      });
    } else {
      return { error: 'idToken is not valid' };
    }
  }

  async checkProfileAssociated(idToken: string): Promise<any> {
    const token: any = await this.validateToken(idToken);

    if (token.valid) {
      const pool = new Pool(victorCredentials);
      const userProfile: Promise<any> = pool.query(getUserProfileQuery, [token.uid]);

      return userProfile.then((profile: any) => {
        return profile.rows.length;
      }).catch((error: Error) => {
        return error.message;
      });
    }
  }

  async updateUserEmail(idToken: string, email: string) {
    const token: any = await this.validateToken(idToken);

    if (token.valid) {
      const pool = new Pool(victorCredentials);
      const userWithEmailProvider: any = await pool.query(getUserWithEmailProviderQuery, [token.uid]);
    }
  }

  async verifyEmail(idToken: string) {
    const token: any = await this.validateToken(idToken);

    if (token.valid) {
      const pool = new Pool(victorCredentials);
      pool.query(validateUserEmailQuery, [token.uid]);
      pool.query(validateProviderEmailQuery, [token.uid]);
    }
  }
}
