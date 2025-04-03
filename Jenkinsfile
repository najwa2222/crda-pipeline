pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'najwa22/crda-app'
        KUBE_DIR = 'kubernetes'
        KUBECONFIG = credentials('kubeconfig')
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-credentials')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    extensions: [],
                    userRemoteConfigs: [[
                        url: env.REPO_URL,
                        credentialsId: 'github-creds'
                    ]]
                ])
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                script {
                    docker.build("${DOCKER_IMAGE}:${env.BUILD_ID}")
                    docker.withRegistry('https://registry.hub.docker.com', 'dockerhub-credentials') {
                        docker.image("${DOCKER_IMAGE}:${env.BUILD_ID}").push()
                        docker.image("${DOCKER_IMAGE}:${env.BUILD_ID}").push('latest')
                    }
                }
            }
        }

        stage('Prepare K8s Manifests') {
            steps {
                script {
                    def deployment = readFile("${KUBE_DIR}/app-deployment.yaml")
                    deployment = deployment.replace('${BUILD_ID}', env.BUILD_ID)
                    writeFile(file: "${KUBE_DIR}/app-deployment-${env.BUILD_ID}.yaml", text: deployment)
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                bat """
                    kubectl apply -f ${KUBE_DIR}/mysql-secret.yaml
                    kubectl apply -f ${KUBE_DIR}/mysql-pv.yaml
                    kubectl apply -f ${KUBE_DIR}/mysql-configmap.yaml
                    kubectl apply -f ${KUBE_DIR}/mysql-deployment.yaml
                    kubectl apply -f ${KUBE_DIR}/app-deployment-${env.BUILD_ID}.yaml
                    
                    timeout /t 30 /nobreak
                    kubectl rollout status deployment/mysql-deployment --timeout=60s
                    kubectl rollout status deployment/app-deployment --timeout=120s
                """
            }
        }
    }

    post {
        always {
            bat "del /Q ${KUBE_DIR}\\app-deployment-*.yaml 2> nul"
            echo "Cleanup complete"
        }
        success {
            bat """
            echo 'Verifying secrets...'
            kubectl get secret mysql-secret -o jsonpath='{.data.password}' | base64 -d
            kubectl get svc crda-service"
            """
        }
        failure {
            bat "kubectl describe pod -l app=crda-app"
            bat "kubectl logs -l app=crda-app --all-containers"
        }
    }
}