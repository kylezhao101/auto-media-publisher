from supabase import create_client

import env

SUPABASE_URL = env.SUPABASE_URL
SUPABASE_KEY = env.SUPABASE_KEY

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
)


response = supabase.auth.sign_in_with_password(
    {
        "email": "kylezhao101@gmail.com",
        "password": "842869",
    }
)

# response = supabase.auth.sign_in_with_password(
#     {
#         "email": "kylerius01@gmail.com",
#         "password": "123123",
#     }
# )

print(response.session.access_token)
